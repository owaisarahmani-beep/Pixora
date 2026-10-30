import { registerWebModule, NativeModule } from 'expo';

class PixoraEditorModule extends NativeModule<{}> {
  async processImageAsync(sourceUri: string, options: any): Promise<string> {
    return sourceUri;
  }
  async shareMediaAsync(uris: string[], dialogTitle?: string): Promise<boolean> {
    return false;
  }
}

export default registerWebModule(PixoraEditorModule, 'PixoraEditorModule');
