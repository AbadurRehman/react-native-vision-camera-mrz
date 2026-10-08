import { useMemo } from 'react';
import type {
  MrzTextRecognizer,
  MrzTextRecognizerOptions,
} from '../specs/MrzTextRecognizer.nitro';
import { createMrzTextRecognizer } from './createMrzTextRecognizer';

/**
 * Creates an {@link MrzTextRecognizer} once and keeps it while the region of
 * interest stays the same. Safe to call with an inline options object.
 *
 * @throws {RangeError} If `regionOfInterest` is not inside the frame.
 */
export function useMrzTextRecognizer(
  options: MrzTextRecognizerOptions = {}
): MrzTextRecognizer {
  const region = options.regionOfInterest;
  const hasRegion = region !== undefined;
  // Depend on the numbers rather than the object, so a new object with the same
  // values does not create a new recognizer. Missing values become NaN, which
  // fails validation instead of being silently ignored.
  const x = region?.x ?? Number.NaN;
  const y = region?.y ?? Number.NaN;
  const width = region?.width ?? Number.NaN;
  const height = region?.height ?? Number.NaN;

  return useMemo(
    () =>
      createMrzTextRecognizer(
        hasRegion ? { regionOfInterest: { x, y, width, height } } : {}
      ),
    [hasRegion, x, y, width, height]
  );
}
