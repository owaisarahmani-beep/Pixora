import { NativeModule, requireNativeModule } from 'expo';

export type PixoraEditOptions = {
  brightness?: number; // -1 to 1
  contrast?: number; // 0 to 2 (1 = normal)
  saturation?: number; // 0 to 2 (1 = normal)
  warmth?: number; // -1 to 1 (0 = normal)
  filter?: 'Original' | 'Mono' | 'Vintage' | 'Fade' | 'Cool' | 'Warm';
  rotation?: number; // 0, 90, 180, 270
  flipX?: boolean;
  flipY?: boolean;
  crop?: {
    originX: number;
    originY: number;
    width: number;
    height: number;
  };
};

declare class PixoraEditorModule extends NativeModule<{}> {
  processImageAsync(sourceUri: string, options: PixoraEditOptions): Promise<string>;
}

export default requireNativeModule<PixoraEditorModule>('PixoraEditor');
