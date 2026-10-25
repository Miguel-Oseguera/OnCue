import { Component, type PropsWithChildren } from "react";
import { Modal } from "react-native";
import { Button, Heading, Notice, Page } from "../oncue/task-ui";
import CaptureScreen from "./capture-screen";

class CaptureBoundary extends Component<
  PropsWithChildren<{ onClose: () => void }>,
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error("[OnCue] Capture screen failed", error.message);
  }
  render() {
    if (this.state.error)
      return (
        <Page>
          <Heading
            title="Capture couldn’t open"
            subtitle="The error is shown here so it can be diagnosed."
            section="GLASSES"
          />
          <Notice text={this.state.error.message} />
          <Button label="Return to dashboard" onPress={this.props.onClose} />
        </Page>
      );
    return this.props.children;
  }
}
export function CaptureModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      presentationStyle="fullScreen"
      animationType="slide"
      onRequestClose={onClose}
    >
      <CaptureBoundary onClose={onClose}>
        <CaptureScreen onClose={onClose} />
      </CaptureBoundary>
    </Modal>
  );
}
