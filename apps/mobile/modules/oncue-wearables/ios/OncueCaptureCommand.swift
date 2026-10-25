import Foundation

/// Only complete utterances trigger a capture; ordinary conversation is discarded.
enum OncueCaptureCommand {
  static func matches(_ text: String) -> Bool {
    let words = text.lowercased().components(separatedBy: CharacterSet.alphanumerics.inverted)
      .filter { !$0.isEmpty }.joined(separator: " ")
    return ["oncue capture this task", "on cue capture this task", "on queue capture this task"].contains(words)
  }
}
