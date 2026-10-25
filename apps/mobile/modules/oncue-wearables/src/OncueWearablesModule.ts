import { NativeModule, requireOptionalNativeModule } from "expo";
import type {
  VoiceLaunchState,
  CaptureState,
  GlassesEvents,
  GlassesStatus,
} from "./OncueWearables.types";

export declare class ConnectionModule extends NativeModule<GlassesEvents> {
  readonly bridgeVersion?: number;
  setVoiceLaunchAllowed(allowed: boolean): Promise<void>;
  getVoiceLaunchState(): Promise<VoiceLaunchState>;
  setCaptureOwner(owner: string | null): Promise<void>;
  setReportDescription(
    id: string,
    owner: string,
    text: string,
  ): Promise<CaptureState>;
  setReportDelivery(
    id: string,
    owner: string,
    status: string,
    message: string | null,
    taskIds: string[],
  ): Promise<CaptureState>;
  getCaptureState(): Promise<CaptureState>;
  startHandsFree(): Promise<CaptureState>;
  stopHandsFree(): Promise<CaptureState>;
  capturePhoto(): Promise<CaptureState>;
  getStatus(): Promise<GlassesStatus>;
  startRegistration(): Promise<GlassesStatus>;
}
// Older development builds and Expo Go must remain usable without this bridge.
export default requireOptionalNativeModule<ConnectionModule>("OncueWearables");
