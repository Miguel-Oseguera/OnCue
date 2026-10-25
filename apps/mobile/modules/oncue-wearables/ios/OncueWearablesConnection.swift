import Foundation
import MWDATCore

/// Registration and observable Bluetooth links only. No sensor session is started.
@MainActor
final class OncueWearablesConnection {
  static let shared = OncueWearablesConnection()
  private var configured = false
  private var lastError: String?
  private var registrationBusy = false
  private var registrationToken: (any AnyListenerToken)?
  private var devicesToken: (any AnyListenerToken)?
  private var deviceTokens: [String: [any AnyListenerToken]] = [:]
  private var observers: [UUID: ([String: Any]) -> Void] = [:]

  private init() {}

  func configure() throws {
    #if targetEnvironment(simulator)
    return
    #else
    guard !configured else { return }
    do {
      try Wearables.configure()
    } catch {
      guard error == .alreadyConfigured else {
        lastError = error.localizedDescription
        throw error
      }
    }
    configured = true
    lastError = nil
    registrationToken = Wearables.shared.addRegistrationStateListener { [weak self] _ in
      Task { @MainActor in self?.publish() }
    }
    devicesToken = Wearables.shared.addDevicesListener { [weak self] identifiers in
      Task { @MainActor in self?.observeDevices(identifiers) }
    }
    observeDevices(Wearables.shared.devices)
    #endif
  }

  func status() -> [String: Any] {
    #if targetEnvironment(simulator)
    return ["supported": false, "reason": "Use OnCue on a physical iPhone to connect Meta glasses.", "registration": "unavailable", "busy": false, "devices": [], "error": NSNull()]
    #else
    if !configured { try? configure() }
    let registration = configured ? registrationName(Wearables.shared.registrationState) : "unavailable"
    let devices: [[String: Any]] = configured ? Wearables.shared.devices.compactMap { identifier in
      guard let device = Wearables.shared.deviceForIdentifier(identifier) else { return nil }
      return ["id": identifier, "name": device.name.isEmpty ? "Meta glasses" : device.name,
              "linkState": linkName(device.linkState),
              "batteryLevel": device.batteryLevel.map { $0 as Any } ?? NSNull(),
              "compatibility": device.compatibility().displayString]
    } : []
    return ["supported": true, "registration": registration, "busy": registrationBusy,
            "devices": devices, "error": lastError.map { $0 as Any } ?? NSNull()]
    #endif
  }

  func register() async throws -> [String: Any] {
    #if targetEnvironment(simulator)
    throw ConnectionError.physicalIPhoneRequired
    #else
    try configure()
    guard !registrationBusy else { throw ConnectionError.registrationInProgress }
    if Wearables.shared.registrationState == .registered { return status() }
    registrationBusy = true
    lastError = nil
    publish()
    defer { registrationBusy = false; publish() }
    do {
      try await Wearables.shared.startRegistration()
    } catch {
      lastError = error.localizedDescription
      throw error
    }
    return status()
    #endif
  }

  nonisolated static func isMetaCallback(_ url: URL) -> Bool {
    guard url.scheme?.lowercased() == "mobile",
      let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return false }
    return components.queryItems?.contains { $0.name == "metaWearablesAction" } == true
  }

  func handleCallback(_ url: URL) async {
    guard Self.isMetaCallback(url) else { return }
    #if !targetEnvironment(simulator)
    do {
      try configure()
      _ = try await Wearables.shared.handleUrl(url)
      lastError = nil
    } catch {
      lastError = error.localizedDescription
    }
    publish()
    #endif
  }

  func addObserver(_ observer: @escaping ([String: Any]) -> Void) -> UUID {
    let id = UUID()
    observers[id] = observer
    observer(status())
    return id
  }

  func removeObserver(_ id: UUID) { observers.removeValue(forKey: id) }

  private func observeDevices(_ identifiers: [String]) {
    let removed = deviceTokens.keys.filter { !identifiers.contains($0) }
    for id in removed {
      if let tokens = deviceTokens.removeValue(forKey: id) {
        Task { for token in tokens { await token.cancel() } }
      }
    }
    for id in identifiers where deviceTokens[id] == nil {
      guard let device = Wearables.shared.deviceForIdentifier(id) else { continue }
      deviceTokens[id] = [
        device.addLinkStateListener { [weak self] _ in Task { @MainActor in self?.publish() } },
        device.addDeviceStateListener { [weak self] _ in Task { @MainActor in self?.publish() } },
        device.addCompatibilityListener { [weak self] _ in Task { @MainActor in self?.publish() } },
      ]
    }
    publish()
  }

  private func publish() {
    let snapshot = status()
    for observer in observers.values { observer(snapshot) }
  }

  private func registrationName(_ state: RegistrationState) -> String {
    switch state {
    case .unavailable: return "unavailable"
    case .available: return "available"
    case .registering: return "registering"
    case .registered: return "registered"
    }
  }

  private func linkName(_ state: LinkState) -> String {
    switch state {
    case .disconnected: return "disconnected"
    case .connecting: return "connecting"
    case .connected: return "connected"
    }
  }
}

private enum ConnectionError: LocalizedError {
  case physicalIPhoneRequired
  case registrationInProgress
  var errorDescription: String? {
    switch self {
    case .physicalIPhoneRequired: return "Connect your glasses using OnCue on a physical iPhone."
    case .registrationInProgress: return "Finish the current registration in Meta AI, then return to OnCue."
    }
  }
}
