import { NativeModule, requireOptionalNativeModule } from "expo";
import type {
  CaptureState,
  GlassesEvents,
  GlassesStatus,
} from "./OncueWearables.types";

export declare class ConnectionModule extends NativeModule<GlassesEvents> {
  readonly bridgeVersion?: number;
  getCaptureState(): Promise<CaptureState>;
  startHandsFree(): Promise<CaptureState>;
  stopHandsFree(): Promise<CaptureState>;
  capturePhoto(): Promise<CaptureState>;
  getStatus(): Promise<GlassesStatus>;
  startRegistration(): Promise<GlassesStatus>;
}
// Older development builds and Expo Go must remain usable without this bridge.
export default requireOptionalNativeModule<ConnectionModule>("OncueWearables");
