import type { HybridObject } from 'react-native-nitro-modules';
import type { Frame } from 'react-native-vision-camera';

/**
 * Native frame processor plugin (Swift on iOS, Kotlin on Android).
 *
 * Phase 1 only exposes a smoke-test method that proves a VisionCamera
 * `Frame` reaches native code. The MRZ text recognizer replaces it in Phase 3.
 */
export interface VisionCameraMrz extends HybridObject<{
  ios: 'swift';
  android: 'kotlin';
}> {
  /**
   * Returns the frame size as seen by native code, e.g. `"1920x1080"`.
   * Must be called synchronously inside a frame processor (worklet).
   */
  describeFrame(frame: Frame): string;
}
