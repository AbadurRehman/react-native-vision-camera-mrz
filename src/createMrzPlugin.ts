import type { VisionCameraMrz } from './VisionCameraMrz.nitro';

export function createMrzPlugin(): VisionCameraMrz {
  throw new Error(
    "'react-native-vision-camera-mrz' is only supported on iOS and Android."
  );
}
