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
  onVoiceLaunchChange: (status: VoiceLaunchState) => void;
  onCaptureChange: (status: CaptureState) => void;
  onConnectionChange: (status: GlassesStatus) => void;
};

export type CapturedPhoto = {
  id: string;
  uri: string;
  capturedAt: string;
  source: "voice" | "button";
  deviceId: string;
  description?: string | null;
  ownerId?: string | null;
  delivery?: "local" | "pending" | "uploading" | "sent" | "uncertain" | "error";
  deliveryMessage?: string | null;
  taskIds?: string[];
};
export type CaptureState = {
  diagnostics?: string[];
  soundNotice?: string | null;
  collectingDescription: boolean;
  currentDescription: string;
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
    | "describing"
    | "paused"
    | "stopping"
    | "error";
  error: string | null;
  photos: CapturedPhoto[];
};

export type VoiceLaunchState = {
  ready: boolean;
  error: string | null;
  lastLaunchId: string | null;
};
