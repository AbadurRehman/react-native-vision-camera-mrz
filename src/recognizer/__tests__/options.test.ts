import { describe, expect, it } from '@jest/globals';
import type { MrzTextRecognizerOptions } from '../../specs/MrzTextRecognizer.nitro';
import { isValidRegion, sanitizeRecognizerOptions } from '../options';

describe('isValidRegion', () => {
  it.each([
    [{ x: 0, y: 0, width: 1, height: 1 }],
    [{ x: 0, y: 0.55, width: 1, height: 0.3 }],
    [{ x: 0.6, y: 0.7, width: 0.4, height: 0.3 }],
    // Floating-point sums slightly above 1 are tolerated.
    [{ x: 0.1, y: 0.2, width: 0.9 + 1e-12, height: 0.8 }],
  ])('accepts %j', (region) => {
    expect(isValidRegion(region)).toBe(true);
  });

  it.each([
    [{ x: -0.1, y: 0, width: 0.5, height: 0.5 }, 'negative x'],
    [{ x: 0, y: -0.1, width: 0.5, height: 0.5 }, 'negative y'],
    [{ x: 0, y: 0, width: 0, height: 0.5 }, 'zero width'],
    [{ x: 0, y: 0, width: 0.5, height: 0 }, 'zero height'],
    [{ x: 0.5, y: 0, width: 0.6, height: 0.5 }, 'past the right edge'],
    [{ x: 0, y: 0.5, width: 0.5, height: 0.6 }, 'past the bottom edge'],
    [{ x: Number.NaN, y: 0, width: 1, height: 1 }, 'NaN'],
    [{ x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 1 }, 'Infinity'],
    [{ x: '0', y: 0, width: 1, height: 1 }, 'a string number'],
    [{ x: 0, y: 0, width: 1 }, 'a missing field'],
    [null, 'null'],
    [0.5, 'a number'],
  ])('rejects %j (%s)', (region, _reason) => {
    expect(isValidRegion(region)).toBe(false);
  });
});

describe('sanitizeRecognizerOptions', () => {
  it('returns empty options when no region is given', () => {
    expect(sanitizeRecognizerOptions({})).toEqual({});
  });

  it('copies only the supported region fields', () => {
    const options = {
      regionOfInterest: { x: 0, y: 0.5, width: 1, height: 0.5, extra: true },
      unknownOption: 'ignored',
    } as MrzTextRecognizerOptions;
    expect(sanitizeRecognizerOptions(options)).toEqual({
      regionOfInterest: { x: 0, y: 0.5, width: 1, height: 0.5 },
    });
  });

  it('throws a RangeError for a region outside the frame', () => {
    expect(() =>
      sanitizeRecognizerOptions({
        regionOfInterest: { x: 0.5, y: 0, width: 1, height: 1 },
      })
    ).toThrow(RangeError);
  });

  it.each([null, 'region', 1])(
    'throws a TypeError for options %j',
    (options) => {
      expect(() =>
        sanitizeRecognizerOptions(
          options as unknown as MrzTextRecognizerOptions
        )
      ).toThrow(TypeError);
    }
  );
});
