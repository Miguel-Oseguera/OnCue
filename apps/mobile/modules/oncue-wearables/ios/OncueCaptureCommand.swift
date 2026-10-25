import Foundation

/// Capture is an anchored prefix; stop remains a complete utterance.
enum OncueCaptureCommand {
  enum Action { case capture, stop }
  private static let capturePattern = try! NSRegularExpression(
    pattern: #"^(?:oncue|on\s+(?:cue|queue))[\s,.:;!?-]+capture\s+this\s+task\b[\s,.:;!?-]*(.*)$"#,
    options: [.caseInsensitive, .dotMatchesLineSeparators])

  static func description(_ text: String) -> String? {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    let range = NSRange(trimmed.startIndex..., in: trimmed)
    guard let match = capturePattern.firstMatch(in: trimmed, range: range),
      let descriptionRange = Range(match.range(at: 1), in: trimmed) else { return nil }
    return String(trimmed[descriptionRange]).trimmingCharacters(in: .whitespacesAndNewlines)
  }
  static func action(_ text: String) -> Action? {
    let words = text.lowercased().components(separatedBy: CharacterSet.alphanumerics.inverted)
      .filter { !$0.isEmpty }.joined(separator: " ")
    if ["oncue stop listening", "on cue stop listening", "on queue stop listening"].contains(words) { return .stop }
    return description(text) != nil ? .capture : nil
  }
  static func matches(_ text: String) -> Bool { action(text) == .capture }
}
