import { registerWebModule, NativeModule } from 'expo';

class PixoraEditorModule extends NativeModule<{}> {}

export default registerWebModule(PixoraEditorModule, 'PixoraEditorModule');
