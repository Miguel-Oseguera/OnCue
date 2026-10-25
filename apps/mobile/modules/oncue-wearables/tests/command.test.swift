import Foundation

@main
struct CommandTests {
  static func main() {
    for phrase in ["OnCue, capture this task!", "ONCUE CAPTURE THIS TASK", "On cue, capture this task.", "On Queue capture this task", "  OnCue... capture this task  "] {
      precondition(OncueCaptureCommand.matches(phrase), "Expected match: \(phrase)")
    }
    for phrase in ["", "capture this task", "OnCue", "OnCue capture", "Don't say OnCue capture this task", "OnCue capture this task tomorrow", "oncue capture this tasks", "Turn on cue capture this task", "OnCue delete this task"] {
      precondition(!OncueCaptureCommand.matches(phrase), "Unexpected match: \(phrase)")
    }
    print("14 voice command cases passed")
  }
}
