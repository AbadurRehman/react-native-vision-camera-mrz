import { NitroModules } from 'react-native-nitro-modules';
import type {
  MrzTextRecognizer,
  MrzTextRecognizerFactory,
  MrzTextRecognizerOptions,
} from '../specs/MrzTextRecognizer.nitro';
import { sanitizeRecognizerOptions } from './options';

let factory: MrzTextRecognizerFactory | undefined;

/**
 * Creates an on-device text recognizer for use in a VisionCamera frame
 * processor. Uses Apple Vision on iOS and ML Kit on Android.
 *
 * @throws {RangeError} If `regionOfInterest` is not inside the frame.
 * @example
 * const recognizer = createMrzTextRecognizer({
 *   regionOfInterest: { x: 0, y: 0.6, width: 1, height: 0.3 },
 * });
 * const frameOutput = useFrameOutput({
 *   onFrame(frame) {
 *     'worklet';
 *     const lines = recognizer.recognizeText(frame);
 *     frame.dispose();
 *   },
 * });
 */
export function createMrzTextRecognizer(
  options: MrzTextRecognizerOptions = {}
): MrzTextRecognizer {
  const sanitized = sanitizeRecognizerOptions(options);
  // Created lazily, so importing the library never touches native code.
  factory ??= NitroModules.createHybridObject<MrzTextRecognizerFactory>(
    'MrzTextRecognizerFactory'
  );
  return factory.createTextRecognizer(sanitized);
}
