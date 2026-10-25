import Foundation
import AVFoundation
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
  var description: String?
  var ownerId: String?
  var delivery: String?
  var deliveryMessage: String?
  var taskIds: [String]?
  var dictionary: [String: Any] {
    ["id": id, "uri": CaptureFiles.directory.appendingPathComponent(fileName).absoluteString,
     "capturedAt": capturedAt, "source": source, "deviceId": deviceId,
     "description": description.map { $0 as Any } ?? NSNull(),
     "ownerId": ownerId.map { $0 as Any } ?? NSNull(),
     "delivery": delivery ?? "local", "deliveryMessage": deliveryMessage.map { $0 as Any } ?? NSNull(),
     "taskIds": taskIds ?? []]
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
  private var ownerId: String?
  private var captureOwnerId: String?
  private var collectingDescription = false
  private var descriptionText = ""
  private var descriptionSettled = true
  private var pendingPhoto: SavedCapture?
  private var descriptionTimeout: Task<Void, Never>?
  private var descriptionLimit: Task<Void, Never>?

  private var soundNotice: String?
  private var error: String?
  private var generation = UUID()
  private var lastCommand = Date.distantPast
  private var startupTimeout: Task<Void, Never>?
  private var captureTimeout: Task<Void, Never>?

  private init() {
    if let data = try? Data(contentsOf: CaptureFiles.manifest),
      let saved = try? JSONDecoder().decode([SavedCapture].self, from: data) {
      captures = saved.filter { FileManager.default.fileExists(atPath: CaptureFiles.directory.appendingPathComponent($0.fileName).path) }.map { capture in
        var restored = capture
        if restored.delivery == "uploading" {
          restored.delivery = "uncertain"
          restored.deliveryMessage = "OnCue closed before delivery was confirmed. Check your tasks before retrying."
        }
        return restored
      }
      try? JSONEncoder().encode(captures).write(to: CaptureFiles.manifest, options: .atomic)
    }
  }

  func snapshot() -> [String: Any] {
    ["enabled": enabled, "listening": listening, "capturing": capturing || saving,
     "readyForCapture": enabled && listening && !capturing && !saving && photoStopped,
     "soundNotice": soundNotice.map { $0 as Any } ?? NSNull(),
     "collectingDescription": collectingDescription, "currentDescription": descriptionText,
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
    settleDescription()
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
      Task { @MainActor in
        guard let self, self.generation == run else { return }
        self.transcription(result.text, final: result.isFinal)
      }
    })
    attached.start()
  }

  private func capture(trigger: String, initialDescription: String = "") throws {
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
    source = trigger; captureOwnerId = ownerId; pendingPhoto = nil
    descriptionText = String(initialDescription.prefix(10_000)); descriptionSettled = false
    collectingDescription = true
    scheduleDescriptionEnd(seconds: descriptionText.isEmpty ? 8 : 2)
    descriptionLimit = Task { [weak self] in
      try? await Task.sleep(for: .seconds(30))
      guard !Task.isCancelled else { return }
      self?.settleDescription()
    }
    capturing = true; photoStopped = false
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
      pendingPhoto = saved
      photo?.stop()
      if !descriptionSettled { phase = "describing"; publish() }
      completeReportIfReady()
    } catch { captureFailed(error.localizedDescription) }
  }

  func setOwner(_ value: String?) { ownerId = value }

  func interruptDeliveries() {
    guard captures.contains(where: { $0.delivery == "uploading" }) else { return }
    var updated = captures
    for index in updated.indices where updated[index].delivery == "uploading" {
      updated[index].delivery = "uncertain"
      updated[index].deliveryMessage = "The app reloaded before delivery was confirmed. Check tasks before retrying."
    }
    do {
      try JSONEncoder().encode(updated).write(to: CaptureFiles.manifest, options: .atomic)
      captures = updated; publish()
    } catch { self.error = error.localizedDescription; publish() }
  }

  func setDescription(id: String, owner: String, text: String) throws -> [String: Any] {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty, trimmed.count <= 10_000,
      let index = captures.firstIndex(where: { $0.id == id && $0.ownerId == owner }),
      ["local", "uncertain", "error"].contains(captures[index].delivery ?? "local") else {
      throw CaptureFailure("This report cannot be edited while queued, sending, or already processed.")
    }
    var updated = captures; updated[index].description = trimmed
    try JSONEncoder().encode(updated).write(to: CaptureFiles.manifest, options: .atomic)
    captures = updated; publish(); return snapshot()
  }

  func setDelivery(id: String, owner: String, status: String, message: String?, taskIds: [String]) throws -> [String: Any] {
    guard ["pending", "uploading", "sent", "error", "uncertain"].contains(status),
      let index = captures.firstIndex(where: { $0.id == id && $0.ownerId == owner }) else {
      throw CaptureFailure("This report is unavailable for the current account.")
    }
    let current = captures[index].delivery ?? "local"
    let allowed: [String: [String]] = [
      "pending": ["local", "error", "uncertain"],
      "uploading": ["pending"], "sent": ["uploading"],
      "uncertain": ["uploading"], "error": ["uploading"],
    ]
    guard allowed[status]?.contains(current) == true else {
      throw CaptureFailure("This report's delivery state has changed. Refresh before trying again.")
    }
    var updated = captures
    updated[index].delivery = status; updated[index].deliveryMessage = message
    updated[index].taskIds = taskIds
    try JSONEncoder().encode(updated).write(to: CaptureFiles.manifest, options: .atomic)
    captures = updated; publish(); return snapshot()
  }

  private func transcription(_ text: String, final: Bool) {
    guard enabled, listening else { return }
    let action = OncueCaptureCommand.action(text)
    if final, action == .stop {
      NSLog("[OnCue] Stop command recognized; ending hands-free session")
      _ = stop(); return
    }
    if collectingDescription {
      // A repeated command is not part of the task description.
      guard action != .capture, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
      if final {
        descriptionText = String((descriptionText + " " + text).trimmingCharacters(in: .whitespacesAndNewlines).prefix(10_000))
        publish()
      }
      scheduleDescriptionEnd(seconds: 2)
      return
    }
    guard final, action == .capture, !capturing, !saving,
      Date().timeIntervalSince(lastCommand) > 3 else { return }
    lastCommand = Date()
    NSLog("[OnCue] Capture command recognized")
    do { try capture(trigger: "voice", initialDescription: OncueCaptureCommand.description(text) ?? "") }
    catch { self.error = error.localizedDescription; publish() }
  }

  private func scheduleDescriptionEnd(seconds: Double) {
    descriptionTimeout?.cancel()
    descriptionTimeout = Task { [weak self] in
      try? await Task.sleep(for: .seconds(seconds))
      guard !Task.isCancelled else { return }
      self?.settleDescription()
    }
  }
  private func settleDescription() {
    guard !descriptionSettled else { return }
    descriptionTimeout?.cancel(); descriptionLimit?.cancel()
    descriptionSettled = true; collectingDescription = false
    NSLog("[OnCue] Description finalized (%ld characters)", descriptionText.count)
    completeReportIfReady(); publish()
  }
  private func completeReportIfReady() {
    guard descriptionSettled, var saved = pendingPhoto else { return }
    saved.description = descriptionText
    saved.ownerId = captureOwnerId
    saved.delivery = descriptionText.isEmpty || captureOwnerId == nil ? "local" : "pending"
    saved.deliveryMessage = descriptionText.isEmpty ? "No description heard. Add one to send this report." : nil
    do {
      let updated = [saved] + captures
      try JSONEncoder().encode(updated).write(to: CaptureFiles.manifest, options: .atomic)
      captures = updated; pendingPhoto = nil
      NSLog("[OnCue] Photo saved; report %@ is %@", saved.id, saved.delivery ?? "local")
      if !descriptionText.isEmpty {
        soundNotice = CaptureConfirmationDing.shared.play()
        if let notice = soundNotice { NSLog("[OnCue] %@", notice) }
      }
      finishCapture()
    } catch { captureFailed(error.localizedDescription) }
  }

  private func finishCapture() {
    descriptionTimeout?.cancel(); descriptionLimit?.cancel()
    collectingDescription = false; descriptionSettled = true; pendingPhoto = nil
    acceptingPhoto = false; capturing = false; saving = false; photo?.stop()
    if enabled { phase = listening ? "listening" : "paused" }
    else if session == nil { phase = error == nil ? "off" : "error" }
    publish()
  }
  private func captureFailed(_ message: String) {
    NSLog("[OnCue] Capture failed: %@", message)
    error = message; captureTimeout?.cancel(); finishCapture()
  }
  private func fail(_ message: String) {
    error = message; _ = stop()
    if session == nil { phase = "error"; publish() }
  }
  private func releaseSession() {
    startupTimeout?.cancel(); captureTimeout?.cancel()
    settleDescription()
    generation = UUID(); enabled = false; listening = false; capturing = false; acceptingPhoto = false
    let oldTokens = tokens; tokens = []
    Task { for token in oldTokens { await token.cancel() } }
    speech = nil; photo = nil; camera = nil; session = nil; photoStopped = true
  }
}


/// Short native cue: works independently of React and never gates report delivery.
@MainActor
private final class CaptureConfirmationDing: NSObject, AVAudioPlayerDelegate {
  static let shared = CaptureConfirmationDing()
  private var player: AVAudioPlayer?
  private var ownsPlaybackSession = false
  private static let tone: Data = {
    let sampleRate = 22050
    let count = Int(Double(sampleRate) * 0.38)
    var data = Data()
    func word(_ value: UInt16) {
      var little = value.littleEndian
      withUnsafeBytes(of: &little) { data.append(contentsOf: $0) }
    }
    func doubleWord(_ value: UInt32) {
      var little = value.littleEndian
      withUnsafeBytes(of: &little) { data.append(contentsOf: $0) }
    }
    data.append(contentsOf: "RIFF".utf8); doubleWord(UInt32(36 + count * 2))
    data.append(contentsOf: "WAVEfmt ".utf8); doubleWord(16)
    word(1); word(1); doubleWord(UInt32(sampleRate)); doubleWord(UInt32(sampleRate * 2))
    word(2); word(16); data.append(contentsOf: "data".utf8); doubleWord(UInt32(count * 2))
    for index in 0..<count {
      let time = Double(index) / Double(sampleRate)
      let attack = min(1, time / 0.008)
      let release = min(1, Double(count - 1 - index) / (Double(sampleRate) * 0.025))
      let envelope = attack * release * exp(-9 * time)
      let bell = sin(2 * Double.pi * 1046.5 * time) + 0.3 * sin(2 * Double.pi * 2093 * time)
      let sample = Int16(bell * envelope * 0.22 * Double(Int16.max))
      word(UInt16(bitPattern: sample))
    }
    return data
  }()

  func play() -> String? {
    do {
      let audio = AVAudioSession.sharedInstance()
      // Do not replace or deactivate an existing recording/communication session.
      ownsPlaybackSession = ![.playAndRecord, .record, .multiRoute].contains(audio.category)
      if ownsPlaybackSession {
        try audio.setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try audio.setActive(true)
      }
      let newPlayer = try AVAudioPlayer(data: Self.tone, fileTypeHint: AVFileType.wav.rawValue)
      player = newPlayer; newPlayer.delegate = self; newPlayer.volume = 0.7
      guard newPlayer.prepareToPlay(), newPlayer.play() else {
        finish(newPlayer)
        return "Report saved, but the confirmation ding could not play."
      }
      let routes = audio.currentRoute.outputs
      NSLog("[OnCue] Confirmation ding playing via %@", routes.map { $0.portName }.joined(separator: ", "))
      let bluetooth = routes.contains { [.bluetoothA2DP, .bluetoothHFP, .bluetoothLE].contains($0.portType) }
      return bluetooth ? nil : "The ding is using your iPhone’s current audio output. Select your Meta glasses in Control Center to hear it there."
    } catch {
      if let player { finish(player) }
      else { releasePlaybackSession() }
      return "Report saved, but the confirmation ding is unavailable: \(error.localizedDescription)"
    }
  }

  nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
    Task { @MainActor in self.finish(player) }
  }
  nonisolated func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: (any Error)?) {
    Task { @MainActor in self.finish(player) }
  }
  private func finish(_ completed: AVAudioPlayer) {
    guard player === completed else { return }
    player = nil; releasePlaybackSession()
  }
  private func releasePlaybackSession() {
    guard ownsPlaybackSession else { return }
    ownsPlaybackSession = false
    let audio = AVAudioSession.sharedInstance()
    if audio.category == .playback && audio.categoryOptions.contains(.mixWithOthers) {
      try? audio.setActive(false, options: .notifyOthersOnDeactivation)
    }
  }
}
