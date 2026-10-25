import Foundation

/// ASR may include conversational words before the wake phrase in one final segment.
enum OncueCaptureCommand {
  enum Action { case capture, stop }
  private static let capturePattern = try! NSRegularExpression(
    pattern: #"\b(?:oncue|on\s+(?:cue|queue|que|q))[\s,.:;!?-]+capture\s+this\s+task\b[\s,.:;!?-]*"#,
    options: [.caseInsensitive])
  private static let negativePrefix = try! NSRegularExpression(
    pattern: #"(?:don't\s+say|do\s+not\s+say|never\s+say|turn)\s*$"#,
    options: [.caseInsensitive])

  static func description(_ text: String) -> String? {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    let range = NSRange(trimmed.startIndex..., in: trimmed)
    guard let match = capturePattern.matches(in: trimmed, range: range).last,
      let command = Range(match.range, in: trimmed) else { return nil }
    let prefix = String(trimmed[..<command.lowerBound])
    if negativePrefix.firstMatch(in: prefix, range: NSRange(prefix.startIndex..., in: prefix)) != nil { return nil }
    return String(trimmed[command.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
  }
  static func action(_ text: String) -> Action? {
    let stopPattern = try! NSRegularExpression(
      pattern: #"\b(?:oncue|on\s+(?:cue|queue|que|q))[\s,.:;!?-]+stop\s+listening\b[\s,.:;!?-]*$"#,
      options: [.caseInsensitive])
    let range = NSRange(text.startIndex..., in: text)
    if let match = stopPattern.firstMatch(in: text, range: range),
      let command = Range(match.range, in: text) {
      let prefix = String(text[..<command.lowerBound])
      if negativePrefix.firstMatch(in: prefix, range: NSRange(prefix.startIndex..., in: prefix)) == nil { return .stop }
    }
    return description(text) != nil ? .capture : nil
  }
  static func matches(_ text: String) -> Bool { action(text) == .capture }
}
