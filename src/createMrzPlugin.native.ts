import { NitroModules } from 'react-native-nitro-modules';
import type { VisionCameraMrz } from './VisionCameraMrz.nitro';

/**
 * Creates the native MRZ frame processor plugin.
 *
 * Create it once (outside render, or in a `useMemo`) and call its methods
 * inside a `useFrameOutput({ onFrame })` worklet.
 */
export function createMrzPlugin(): VisionCameraMrz {
  return NitroModules.createHybridObject<VisionCameraMrz>('VisionCameraMrz');
}
