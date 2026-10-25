import Foundation
import ExpoModulesCore

public class OncueWearablesModule: Module {
  private var observerID: UUID?
  private var captureObserverID: UUID?
  private var voiceObserverID: UUID?

  public func definition() -> ModuleDefinition {
    Name("OncueWearables")
    Constant("bridgeVersion") { 4 }
    Events("onConnectionChange", "onCaptureChange", "onVoiceLaunchChange")

    AsyncFunction("getStatus") { () async -> [String: Any] in
      await MainActor.run { OncueWearablesConnection.shared.status() }
    }
    AsyncFunction("startRegistration") { () async throws -> [String: Any] in
      try await OncueWearablesConnection.shared.register()
    }
    OnStartObserving("onConnectionChange") { [weak self] in
      Task { @MainActor [weak self] in
        guard let self else { return }
        if let id = self.observerID { OncueWearablesConnection.shared.removeObserver(id) }
        self.observerID = OncueWearablesConnection.shared.addObserver { [weak self] status in
          self?.sendEvent("onConnectionChange", status)
        }
      }
    }
    OnStopObserving("onConnectionChange") { [weak self] in self?.removeObserver() }
    AsyncFunction("setCaptureOwner") { (owner: String?) async in
      await MainActor.run { OncueWearablesCapture.shared.setOwner(owner) }
    }
    AsyncFunction("setReportDescription") { (id: String, owner: String, text: String) async throws -> [String: Any] in
      try await MainActor.run { try OncueWearablesCapture.shared.setDescription(id: id, owner: owner, text: text) }
    }
    AsyncFunction("setReportDelivery") { (id: String, owner: String, status: String, message: String?, taskIds: [String]) async throws -> [String: Any] in
      try await MainActor.run { try OncueWearablesCapture.shared.setDelivery(id: id, owner: owner, status: status, message: message, taskIds: taskIds) }
    }
    AsyncFunction("getCaptureState") { () async -> [String: Any] in
      await MainActor.run { OncueWearablesCapture.shared.snapshot() }
    }
    AsyncFunction("startHandsFree") { () async throws -> [String: Any] in
      try await OncueWearablesCapture.shared.start()
    }
    AsyncFunction("stopHandsFree") { () async -> [String: Any] in
      await MainActor.run { OncueWearablesCapture.shared.stop() }
    }
    AsyncFunction("capturePhoto") { () async throws -> [String: Any] in
      try await MainActor.run { try OncueWearablesCapture.shared.captureFromButton() }
    }
    OnStartObserving("onCaptureChange") { [weak self] in
      Task { @MainActor [weak self] in
        guard let self else { return }
        if let id = self.captureObserverID { OncueWearablesCapture.shared.removeObserver(id) }
        self.captureObserverID = OncueWearablesCapture.shared.addObserver { [weak self] state in
          self?.sendEvent("onCaptureChange", state)
        }
      }
    }
    OnStopObserving("onCaptureChange") { [weak self] in self?.removeCaptureObserver() }
    AsyncFunction("setVoiceLaunchAllowed") { (allowed: Bool) async in
      await MainActor.run { OncueWearablesVoiceLaunch.shared.setAllowed(allowed) }
    }
    AsyncFunction("getVoiceLaunchState") { () async -> [String: Any] in
      await MainActor.run { OncueWearablesVoiceLaunch.shared.snapshot() }
    }
    OnStartObserving("onVoiceLaunchChange") { [weak self] in
      Task { @MainActor [weak self] in
        guard let self else { return }
        if let id = self.voiceObserverID { OncueWearablesVoiceLaunch.shared.removeObserver(id) }
        self.voiceObserverID = OncueWearablesVoiceLaunch.shared.addObserver { [weak self] state in
          self?.sendEvent("onVoiceLaunchChange", state)
        }
      }
    }
    OnStopObserving("onVoiceLaunchChange") { [weak self] in self?.removeVoiceObserver() }
    OnAppBecomesActive { Task { @MainActor in OncueWearablesVoiceLaunch.shared.refresh() } }
    OnAppContextDestroys { Task { @MainActor in
      OncueWearablesVoiceLaunch.shared.setAllowed(nil)
      OncueWearablesCapture.shared.interruptDeliveries()
      OncueWearablesCapture.shared.setOwner(nil)
      _ = OncueWearablesCapture.shared.stop()
    } }
    OnDestroy { [weak self] in self?.removeObserver(); self?.removeCaptureObserver(); self?.removeVoiceObserver() }
  }

  private func removeVoiceObserver() {
    Task { @MainActor [self] in
      guard let id = self.voiceObserverID else { return }
      OncueWearablesVoiceLaunch.shared.removeObserver(id)
      self.voiceObserverID = nil
    }
  }

  private func removeCaptureObserver() {
    Task { @MainActor [self] in
      guard let id = self.captureObserverID else { return }
      OncueWearablesCapture.shared.removeObserver(id)
      self.captureObserverID = nil
    }
  }

  private func removeObserver() {
    Task { @MainActor [self] in
      guard let id = self.observerID else { return }
      OncueWearablesConnection.shared.removeObserver(id)
      self.observerID = nil
    }
  }
}
