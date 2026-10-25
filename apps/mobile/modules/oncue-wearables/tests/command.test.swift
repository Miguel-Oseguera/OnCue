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
    for phrase in ["OnCue, stop listening", "ONCUE STOP LISTENING!", "On cue stop listening.", "On Queue, stop listening"] {
      precondition(OncueCaptureCommand.action(phrase) == .stop, "Expected stop: \(phrase)")
      precondition(!OncueCaptureCommand.matches(phrase), "Stop must never capture")
    }
    for phrase in ["stop listening", "OnCue stop", "Don't say OnCue stop listening", "OnCue stop listening tomorrow", "Hey Meta start OnCue", "OnCue start listening", "OnCue stop listening capture this task"] {
      precondition(OncueCaptureCommand.action(phrase) == nil, "Unexpected action: \(phrase)")
    }
    print("25 voice command cases passed")
  }
}
