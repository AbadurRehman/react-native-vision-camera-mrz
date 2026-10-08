import type {
  MrzTextRecognizer,
  MrzTextRecognizerOptions,
} from '../specs/MrzTextRecognizer.nitro';

/** Fallback for platforms without a native implementation (e.g. web). */
export function createMrzTextRecognizer(
  _options?: MrzTextRecognizerOptions
): MrzTextRecognizer {
  throw new Error(
    "The MRZ text recognizer in 'react-native-vision-camera-mrz' is only available on iOS and Android."
  );
}
