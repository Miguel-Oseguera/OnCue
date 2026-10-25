import Foundation
import ExpoModulesCore

public class OncueWearablesModule: Module {
  private var observerID: UUID?
  private var captureObserverID: UUID?

  public func definition() -> ModuleDefinition {
    Name("OncueWearables")
    Constant("bridgeVersion") { 2 }
    Events("onConnectionChange", "onCaptureChange")

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
    OnAppContextDestroys { Task { @MainActor in _ = OncueWearablesCapture.shared.stop() } }
    OnDestroy { [weak self] in self?.removeObserver(); self?.removeCaptureObserver() }
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
