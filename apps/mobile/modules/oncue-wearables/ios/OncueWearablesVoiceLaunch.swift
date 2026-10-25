import Foundation
import MWDATCore

/// Meta's invocation channel does not keep the custom speech microphone active.
@MainActor
final class OncueWearablesVoiceLaunch {
  static let shared = OncueWearablesVoiceLaunch()
  private var stream: VoiceInvocationsStream?
  private var tokens: [any AnyListenerToken] = []
  private var connectionObserver: UUID?
  private var deviceId: String?
  private var allowed: Bool?
  private var pending: [UUID: LaunchApp] = [:]
  private var deadlines: [UUID: Task<Void, Never>] = [:]
  private var observers: [UUID: ([String: Any]) -> Void] = [:]
  private var lastLaunchId: String?
  private var error: String?

  func configure() {
    #if !targetEnvironment(simulator)
    guard connectionObserver == nil else { return }
    connectionObserver = OncueWearablesConnection.shared.addObserver { [weak self] _ in self?.refresh() }
    #endif
  }

  func refresh() {
    #if !targetEnvironment(simulator)
    do { try OncueWearablesConnection.shared.configure() }
    catch { self.error = error.localizedDescription; publish(); return }
    let wearables = Wearables.shared
    guard wearables.registrationState == .registered,
      let connected = wearables.devices.first(where: { wearables.deviceForIdentifier($0)?.linkState == .connected }) else {
      stream?.stop(); deviceId = nil; publish(); return
    }
    guard deviceId != connected else { return }
    do {
      if stream == nil {
        let created = try VoiceInvocationsStream(wearables: wearables)
        stream = created
        tokens.append(created.invocationsPublisher.listen { [weak self] invocation in
          guard let launch = invocation as? LaunchApp else { return }
          Task { @MainActor in self?.receive(launch) }
        })
        tokens.append(created.errorPublisher.listen { [weak self] error in
          Task { @MainActor in
            guard let self else { return }
            self.error = error.localizedDescription; self.deviceId = nil; self.publish()
          }
        })
      }
      try stream?.start(deviceIdentifier: connected)
      deviceId = connected; error = nil
    } catch { self.error = error.localizedDescription; deviceId = nil }
    publish()
    #endif
  }

  func setAllowed(_ value: Bool?) {
    allowed = value
    if value == false { _ = OncueWearablesCapture.shared.stop() }
    if value != nil {
      for id in Array(pending.keys) { resolve(id) }
    }
  }

  func snapshot() -> [String: Any] {
    ["ready": deviceId != nil, "error": error.map { $0 as Any } ?? NSNull(),
     "lastLaunchId": lastLaunchId.map { $0 as Any } ?? NSNull()]
  }
  func addObserver(_ observer: @escaping ([String: Any]) -> Void) -> UUID {
    let id = UUID(); observers[id] = observer; observer(snapshot()); return id
  }
  func removeObserver(_ id: UUID) { observers.removeValue(forKey: id) }
  private func publish() { let status = snapshot(); for observer in observers.values { observer(status) } }

  private func receive(_ launch: LaunchApp) {
    let id = UUID()
    pending[id] = launch
    lastLaunchId = id.uuidString
    publish()
    if allowed != nil { resolve(id); return }
    // Cold launch may arrive before React restores the existing auth session.
    deadlines[id] = Task { [weak self] in
      try? await Task.sleep(for: .seconds(15))
      guard !Task.isCancelled, let self, let request = self.pending.removeValue(forKey: id) else { return }
      self.deadlines.removeValue(forKey: id)
      self.error = "Open OnCue and sign in before starting capture by voice."
      self.publish()
      _ = await request.responseHandle.sendFailure(actionOutput: nil)
    }
  }

  private func resolve(_ id: UUID) {
    guard let launch = pending.removeValue(forKey: id) else { return }
    deadlines.removeValue(forKey: id)?.cancel()
    Task {
      guard allowed == true else {
        error = "Sign in to OnCue before starting capture by voice."; publish()
        _ = await launch.responseHandle.sendFailure(actionOutput: nil)
        return
      }
      do {
        // Target the glasses that delivered the invocation, not another paired pair.
        let status = try await OncueWearablesCapture.shared.start(preferredDeviceId: launch.deviceIdentifier)
        let accepted = status["enabled"] as? Bool == true
        if accepted {
          error = nil; publish()
          _ = await launch.responseHandle.sendSuccess(actionOutput: nil)
        } else {
          error = "Capture is still stopping or saving. Say start OnCue again when it is ready."; publish()
          _ = await launch.responseHandle.sendFailure(actionOutput: nil)
        }
      } catch {
        self.error = error.localizedDescription; publish()
        _ = await launch.responseHandle.sendFailure(actionOutput: nil)
      }
    }
  }
}
