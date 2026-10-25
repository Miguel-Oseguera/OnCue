import Foundation

@main
struct CommandTests {
  static func main() {
    var count = 0
    let captures: [(String, String)] = [
      ("OnCue, capture this task!", ""),
      ("ONCUE CAPTURE THIS TASK", ""),
      ("On cue, capture this task.", ""),
      ("On Queue capture this task", ""),
      ("  OnCue... capture this task  ", ""),
      ("OnCue capture this task tomorrow", "tomorrow"),
      ("OnCue, capture this task. The projector in room 204 is broken.", "The projector in room 204 is broken."),
      ("On cue capture this task: Send AV. Room 204!", "Send AV. Room 204!"),
      ("ON QUEUE, capture this task — Restock water", "— Restock water"),
      ("OnCue capture this task\nThe exit is blocked.", "The exit is blocked."),
    ]
    for (phrase, description) in captures {
      precondition(OncueCaptureCommand.action(phrase) == .capture, "Expected capture: \(phrase)")
      precondition(OncueCaptureCommand.description(phrase) == description, "Wrong description: \(phrase)")
      count += 1
    }
    for phrase in ["OnCue, stop listening", "ONCUE STOP LISTENING!", "On cue stop listening.", "On Queue, stop listening"] {
      precondition(OncueCaptureCommand.action(phrase) == .stop)
      precondition(OncueCaptureCommand.description(phrase) == nil)
      count += 1
    }
    for phrase in ["", "capture this task", "OnCue", "OnCue capture", "Don't say OnCue capture this task", "oncue capture this tasks", "Turn on cue capture this task", "OnCue delete this task", "stop listening", "OnCue stop", "Don't say OnCue stop listening", "OnCue stop listening tomorrow", "Hey Meta start OnCue", "OnCue start listening", "OnCue stop listening capture this task"] {
      precondition(OncueCaptureCommand.action(phrase) == nil, "Unexpected action: \(phrase)")
      count += 1
    }
    print("\(count) voice command and description cases passed")
  }
}
