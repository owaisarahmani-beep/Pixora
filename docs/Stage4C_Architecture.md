# Stage 4C Architecture Plan

## 1. UI & State (Non-Destructive)
*   **Editor Screen**: Accessible from the Viewer.
*   **`useEditorStore`**: Manages the transient, non-destructive edit state:
    *   `crop`, `rotate`, `flip`
    *   `brightness`, `contrast`, `saturation`, `warmth`
    *   `history` (for Undo/Redo)
*   **Live Preview**: Applies visual changes to a screen-resolution image in real-time so the user can see edits instantly.

## 2. Local Processing Engine (Full Resolution)
Because `expo-image-manipulator` only supports spatial transforms (crop, rotate, flip) and does not support color processing (brightness, contrast, etc.), relying on JS-based workarounds (like `react-native-view-shot`) would ruin the image quality by clamping exports to screen resolution.

**Solution**: I will implement a lightweight, custom **Expo Native Module** (`modules/pixora-editor`) written in Kotlin. 
*   It will take the original image URI and the edit state.
*   It will apply Android's native `ColorMatrix` and `Bitmap` operations in memory.
*   It will write the processed full-resolution JPEG/PNG to a temporary file.

## 3. Export to MediaStore
*   The newly generated file is pushed to the Android MediaStore via `MediaLibrary.createAssetAsync(tempUri)`.
*   The original media remains completely untouched, satisfying the non-destructive architecture rule.
