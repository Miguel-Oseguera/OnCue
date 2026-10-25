import Foundation

/// Match complete final utterances only; discard ordinary conversation.
enum OncueCaptureCommand {
  enum Action { case capture, stop }

  static func action(_ text: String) -> Action? {
    let words = text.lowercased().components(separatedBy: CharacterSet.alphanumerics.inverted)
      .filter { !$0.isEmpty }.joined(separator: " ")
    for name in ["oncue", "on cue", "on queue"] {
      if words == "\(name) capture this task" { return .capture }
      if words == "\(name) stop listening" { return .stop }
    }
    return nil
  }
  static func matches(_ text: String) -> Bool { action(text) == .capture }
}
