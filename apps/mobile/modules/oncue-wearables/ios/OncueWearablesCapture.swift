import Foundation
import ImageIO
import UniformTypeIdentifiers
import MWDATCore
import MWDATCamera
import MWDATSpeech

private struct SavedCapture: Codable, Sendable {
  let id: String
  let fileName: String
  let capturedAt: String
  let source: String
  let deviceId: String
  var dictionary: [String: Any] {
    ["id": id, "uri": CaptureFiles.directory.appendingPathComponent(fileName).absoluteString,
     "capturedAt": capturedAt, "source": source, "deviceId": deviceId]
  }
}

private enum CaptureFiles {
  static var directory: URL {
    FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("OnCueCaptures", isDirectory: true)
  }
  static var manifest: URL { directory.appendingPathComponent("captures.json") }
  static func saveImage(_ data: Data, id: String) throws -> String {
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    guard let image = CGImageSourceCreateWithData(data as CFData, nil),
      let thumbnail = CGImageSourceCreateThumbnailAtIndex(image, 0, [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceThumbnailMaxPixelSize: 2560,
      ] as CFDictionary) else { throw CaptureFailure("The glasses photo could not be read.") }
    let name = "\(id).jpg"
    let output = NSMutableData()
    guard let destination = CGImageDestinationCreateWithData(output, UTType.jpeg.identifier as CFString, 1, nil)
      else { throw CaptureFailure("Unable to prepare the photo.") }
    CGImageDestinationAddImage(destination, thumbnail, [kCGImageDestinationLossyCompressionQuality: 0.9] as CFDictionary)
    guard CGImageDestinationFinalize(destination) else { throw CaptureFailure("Unable to save the photo.") }
    try (output as Data).write(to: directory.appendingPathComponent(name), options: .atomic)
    return name
  }
}

private struct CaptureFailure: LocalizedError {
  let message: String
  init(_ message: String) { self.message = message }
  var errorDescription: String? { message }
}

/// Native ownership deliberately outlives React screens and JS event subscribers.
@MainActor
final class OncueWearablesCapture {
  static let shared = OncueWearablesCapture()
  private var session: DeviceSession?
  private var speech: Speech?
  private var camera: Camera?
  private var photo: Photo?
  private var tokens: [any AnyListenerToken] = []
  private var observers: [UUID: ([String: Any]) -> Void] = [:]
  private var captures: [SavedCapture] = []
  private var phase = "off"
  private var enabled = false
  private var listening = false
  private var capturing = false
  private var saving = false
  private var permissionsPending = false
  private var captureRequested = false
  private var acceptingPhoto = false
  private var photoStopped = true
  private var source = "voice"
  private var error: String?
  private var generation = UUID()
  private var lastCommand = Date.distantPast
  private var startupTimeout: Task<Void, Never>?
  private var captureTimeout: Task<Void, Never>?

  private init() {
    if let data = try? Data(contentsOf: CaptureFiles.manifest),
      let saved = try? JSONDecoder().decode([SavedCapture].self, from: data) {
      captures = saved.filter { FileManager.default.fileExists(atPath: CaptureFiles.directory.appendingPathComponent($0.fileName).path) }
    }
  }

  func snapshot() -> [String: Any] {
    ["enabled": enabled, "listening": listening, "capturing": capturing || saving,
     "readyForCapture": enabled && listening && !capturing && !saving && photoStopped,
     "phase": phase, "error": error.map { $0 as Any } ?? NSNull(),
     "photos": captures.map { $0.dictionary }]
  }
  func addObserver(_ observer: @escaping ([String: Any]) -> Void) -> UUID {
    let id = UUID(); observers[id] = observer; observer(snapshot()); return id
  }
  func removeObserver(_ id: UUID) { observers.removeValue(forKey: id) }
  private func publish() { let value = snapshot(); for observer in observers.values { observer(value) } }

  func start(preferredDeviceId: String? = nil) async throws -> [String: Any] {
    #if targetEnvironment(simulator)
    throw CaptureFailure("Hands-free capture requires your connected glasses and a physical iPhone.")
    #else
    guard !enabled, session == nil, !permissionsPending, !saving else { return snapshot() }
    let run = UUID(); generation = run
    permissionsPending = true; phase = "permissions"; error = nil; publish()
    defer { permissionsPending = false }
    do {
      try OncueWearablesConnection.shared.configure()
      guard Wearables.shared.registrationState == .registered else { throw CaptureFailure("Connect your glasses first.") }
      for permission in [Permission.camera, Permission.microphone] {
        let current = try await Wearables.shared.checkPermissionStatus(permission)
        let granted = current == .granted ? current : try await Wearables.shared.requestPermission(permission)
        guard generation == run else { return snapshot() }
        guard granted == .granted else { throw CaptureFailure("Approve camera and microphone access in Meta AI, then try again.") }
      }
      guard let device = Wearables.shared.devices.first(where: {
        (preferredDeviceId == nil || $0 == preferredDeviceId) && Wearables.shared.deviceForIdentifier($0)?.linkState == .connected
      }) else { throw CaptureFailure("No connected glasses. Power them on and check Meta AI.") }
      let created = try Wearables.shared.createSession(deviceSelector: SpecificDeviceSelector(device: device))
      session = created; enabled = true; phase = "starting"
      tokens.append(created.statePublisher.listen { [weak self] state in
        Task { @MainActor in
          guard let self, self.generation == run else { return }
          self.sessionChanged(state)
        }
      })
      tokens.append(created.errorPublisher.listen { [weak self] error in
        Task { @MainActor in
          guard let self, self.generation == run else { return }
          self.fail("Glasses session: \(error.localizedDescription)")
        }
      })
      publish()
      try created.start()
      startupTimeout = Task { [weak self] in
        try? await Task.sleep(for: .seconds(30))
        guard !Task.isCancelled, let self, self.generation == run, !self.listening else { return }
        self.fail("The glasses did not start listening. Check the connection and try again.")
      }
    } catch {
      if generation == run { fail(error.localizedDescription) }
      throw error
    }
    return snapshot()
    #endif
  }

  func stop() -> [String: Any] {
    enabled = false; listening = false
    startupTimeout?.cancel(); captureTimeout?.cancel()
    if session != nil {
      phase = "stopping"; speech?.stop(); photo?.stop(); session?.stop()
    } else {
      generation = UUID(); phase = "off"
    }
    publish(); return snapshot()
  }

  func captureFromButton() throws -> [String: Any] {
    guard enabled, listening, session?.state == .started else {
      throw CaptureFailure("Start hands-free mode and wait for Listening first.")
    }
    try capture(trigger: "button")
    return snapshot()
  }

  private func sessionChanged(_ state: DeviceSessionState) {
    switch state {
    case .started:
      guard enabled else { session?.stop(); return }
      do {
        if speech == nil { try attachSpeech() }
        listening = speech?.state == .started
        phase = capturing ? "capturing" : (listening ? "listening" : "starting")
      } catch { fail(error.localizedDescription); return }
    case .paused:
      listening = false; phase = "paused"
    case .stopping:
      listening = false; phase = "stopping"
    case .stopped:
      releaseSession()
      phase = saving ? "saving" : (error == nil ? "off" : "error")
    case .starting, .idle: phase = "starting"
    }
    publish()
  }

  private func attachSpeech() throws {
    guard let session, let attached = try session.addSpeech() else {
      throw CaptureFailure("Speech is unavailable. Enable the experimental Speech capability for OnCue in Wearables Developer Center.")
    }
    speech = attached
    let run = generation
    tokens.append(attached.statePublisher.listen { [weak self] state in
      Task { @MainActor in
        guard let self, self.generation == run else { return }
        self.listening = self.enabled && state == .started && self.session?.state == .started
        if self.listening {
          self.startupTimeout?.cancel()
          self.phase = self.capturing ? "capturing" : "listening"
        } else if self.enabled && state == .stopped && self.session?.state == .started {
          self.fail("Speech stopped. Start hands-free mode again when ready."); return
        }
        self.publish()
      }
    })
    tokens.append(attached.errorPublisher.listen { [weak self] error in
      Task { @MainActor in
        guard let self, self.generation == run else { return }
        self.fail("Speech: \(error.localizedDescription)")
      }
    })
    tokens.append(attached.transcriptionPublisher.listen { [weak self] result in
      guard result.isFinal, let action = OncueCaptureCommand.action(result.text) else { return }
      Task { @MainActor in
        guard let self, self.generation == run, self.enabled, self.listening else { return }
        // Stop must bypass capture busy/cooldown checks.
        if action == .stop { _ = self.stop(); return }
        guard !self.capturing, Date().timeIntervalSince(self.lastCommand) > 3 else { return }
        self.lastCommand = Date()
        do { try self.capture(trigger: "voice") }
        catch { self.error = error.localizedDescription; self.publish() }
      }
    })
    attached.start()
  }

  private func capture(trigger: String) throws {
    guard enabled, session?.state == .started, !capturing, photoStopped else { return }
    guard let session else { return }
    if camera == nil {
      guard let attached = try session.addCamera() else { throw CaptureFailure("The glasses camera is not ready.") }
      camera = attached; photo = attached.photo
      let run = generation
      tokens.append(attached.photo.statePublisher.listen { [weak self] state in
        Task { @MainActor in
          guard let self, self.generation == run else { return }
          self.photoStopped = state == .stopped
          if state == .started, self.enabled, self.capturing, !self.captureRequested {
            self.captureRequested = true
            self.photo?.capturePhoto(resolution: .large, quality: .high)
          }
          self.publish()
        }
      })
      tokens.append(attached.photo.photoDataPublisher.listen { [weak self] data in
        Task { @MainActor in
          guard let self, self.generation == run, self.acceptingPhoto else { return }
          self.acceptingPhoto = false
          await self.savePhoto(data.imageData, timestamp: data.timestamp)
        }
      })
      tokens.append(attached.photo.errorPublisher.listen { [weak self] error in
        Task { @MainActor in
          guard let self, self.generation == run else { return }
          self.captureFailed("Photo: \(error.localizedDescription)")
        }
      })
    }
    source = trigger; capturing = true; photoStopped = false
    acceptingPhoto = true; captureRequested = false; error = nil; phase = "capturing"; publish()
    photo?.start()
    let run = generation
    captureTimeout?.cancel()
    captureTimeout = Task { [weak self] in
      try? await Task.sleep(for: .seconds(45))
      guard !Task.isCancelled, let self, self.generation == run, self.acceptingPhoto else { return }
      self.captureFailed("The photo did not arrive. Check your glasses and try again.")
    }
  }

  private func savePhoto(_ data: Data, timestamp: Date) async {
    captureTimeout?.cancel(); saving = true; phase = "saving"; publish()
    let id = UUID().uuidString
    let device = session?.deviceId ?? ""
    let trigger = source
    do {
      let name = try await Task.detached(priority: .utility) { try CaptureFiles.saveImage(data, id: id) }.value
      let saved = SavedCapture(id: id, fileName: name, capturedAt: ISO8601DateFormatter().string(from: timestamp), source: trigger, deviceId: device)
      let updated = [saved] + captures
      try JSONEncoder().encode(updated).write(to: CaptureFiles.manifest, options: .atomic)
      captures = updated
      finishCapture()
    } catch { captureFailed(error.localizedDescription) }
  }

  private func finishCapture() {
    acceptingPhoto = false; capturing = false; saving = false; photo?.stop()
    if enabled { phase = listening ? "listening" : "paused" }
    else if session == nil { phase = error == nil ? "off" : "error" }
    publish()
  }
  private func captureFailed(_ message: String) {
    error = message; captureTimeout?.cancel(); finishCapture()
  }
  private func fail(_ message: String) {
    error = message; _ = stop()
    if session == nil { phase = "error"; publish() }
  }
  private func releaseSession() {
    startupTimeout?.cancel(); captureTimeout?.cancel()
    generation = UUID(); enabled = false; listening = false; capturing = false; acceptingPhoto = false
    let oldTokens = tokens; tokens = []
    Task { for token in oldTokens { await token.cancel() } }
    speech = nil; photo = nil; camera = nil; session = nil; photoStopped = true
  }
}
