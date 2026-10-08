import type { HybridObject } from 'react-native-nitro-modules';
import type { Frame } from 'react-native-vision-camera';

/**
 * A rectangle in normalized coordinates (0-1) of the upright frame, with the
 * origin at the top-left. "Upright" means rotated the way the user sees it;
 * mirroring (front camera) is not applied.
 */
export interface MrzRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One line of text found in a frame. */
export interface MrzTextLine {
  /** The text as recognized, before any MRZ clean-up. */
  text: string;
  boundingBox: MrzRect;
}

export interface MrzTextRecognizerOptions {
  /**
   * Only text inside this region is returned. On iOS the region also limits
   * the area that is processed, which makes recognition faster.
   * Defaults to the whole frame.
   */
  regionOfInterest?: MrzRect;
}

/** Reads text from camera frames, entirely on-device. */
export interface MrzTextRecognizer extends HybridObject<{
  ios: 'swift';
  android: 'kotlin';
}> {
  /**
   * Recognizes text in the frame synchronously and returns its lines in
   * reading order (top to bottom, then left to right).
   * Call it inside a frame processor and dispose the frame afterwards.
   */
  recognizeText(frame: Frame): MrzTextLine[];
}

export interface MrzTextRecognizerFactory extends HybridObject<{
  ios: 'swift';
  android: 'kotlin';
}> {
  createTextRecognizer(options: MrzTextRecognizerOptions): MrzTextRecognizer;
}
