import { registerWebModule, NativeModule } from 'expo';

class OncueWearablesModule extends NativeModule<{}> {}

export default registerWebModule(OncueWearablesModule, 'OncueWearablesModule');
