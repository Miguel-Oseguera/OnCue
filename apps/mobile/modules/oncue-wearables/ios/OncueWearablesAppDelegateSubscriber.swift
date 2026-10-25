import ExpoModulesCore
import UIKit

/// Expo forwards warm and cold scene URLs to app-delegate subscribers.
public class OncueWearablesAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    Task { @MainActor in try? OncueWearablesConnection.shared.configure() }
    return true
  }

  public func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    guard OncueWearablesConnection.isMetaCallback(url) else { return false }
    Task { @MainActor in await OncueWearablesConnection.shared.handleCallback(url) }
    return true
  }
}
