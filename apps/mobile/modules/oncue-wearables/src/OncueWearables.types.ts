export type RegistrationState =
  "unavailable" | "available" | "registering" | "registered";
export type GlassesDevice = {
  id: string;
  name: string;
  linkState: "disconnected" | "connecting" | "connected";
  batteryLevel: number | null;
  compatibility: string;
};
export type GlassesStatus = {
  supported: boolean;
  reason?: string;
  registration: RegistrationState;
  busy: boolean;
  devices: GlassesDevice[];
  error: string | null;
};
export type GlassesEvents = {
  onCaptureChange: (status: CaptureState) => void;
  onConnectionChange: (status: GlassesStatus) => void;
};

export type CapturedPhoto = {
  id: string;
  uri: string;
  capturedAt: string;
  source: "voice" | "button";
  deviceId: string;
};
export type CaptureState = {
  enabled: boolean;
  listening: boolean;
  capturing: boolean;
  readyForCapture: boolean;
  phase:
    | "off"
    | "permissions"
    | "starting"
    | "listening"
    | "capturing"
    | "saving"
    | "paused"
    | "stopping"
    | "error";
  error: string | null;
  photos: CapturedPhoto[];
};
