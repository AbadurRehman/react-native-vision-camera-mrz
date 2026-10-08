import type {
  MrzRect,
  MrzTextRecognizerOptions,
} from '../specs/MrzTextRecognizer.nitro';

/** Allows for floating-point error in `x + width` and `y + height`. */
const TOLERANCE = 1e-9;

/** `true` when `value` is a non-empty rectangle inside the normalized frame. */
export function isValidRegion(value: unknown): value is MrzRect {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { x, y, width, height } = value as Partial<
    Record<keyof MrzRect, unknown>
  >;
  return (
    isFiniteNumber(x) &&
    isFiniteNumber(y) &&
    isFiniteNumber(width) &&
    isFiniteNumber(height) &&
    x >= 0 &&
    y >= 0 &&
    width > 0 &&
    height > 0 &&
    x + width <= 1 + TOLERANCE &&
    y + height <= 1 + TOLERANCE
  );
}

/**
 * Validates options and returns a copy with only the supported fields, so
 * nothing unexpected is passed to native code.
 *
 * @throws {TypeError} If `options` is not an object.
 * @throws {RangeError} If `regionOfInterest` is not inside the frame.
 */
export function sanitizeRecognizerOptions(
  options: MrzTextRecognizerOptions
): MrzTextRecognizerOptions {
  if (typeof options !== 'object' || options === null) {
    throw new TypeError('MrzTextRecognizer options must be an object.');
  }
  const { regionOfInterest } = options;
  if (regionOfInterest === undefined) {
    return {};
  }
  if (!isValidRegion(regionOfInterest)) {
    throw new RangeError(
      'regionOfInterest must lie inside the frame: x and y ≥ 0, width and height > 0, ' +
        'x + width ≤ 1 and y + height ≤ 1 (normalized coordinates).'
    );
  }
  const { x, y, width, height } = regionOfInterest;
  return { regionOfInterest: { x, y, width, height } };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
