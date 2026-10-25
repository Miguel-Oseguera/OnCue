import { NativeModule, requireNativeModule } from 'expo';

declare class OncueWearablesModule extends NativeModule<{}> {}

export default requireNativeModule<OncueWearablesModule>('OncueWearables');
