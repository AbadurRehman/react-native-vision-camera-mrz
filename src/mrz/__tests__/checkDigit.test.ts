import { describe, expect, it } from '@jest/globals';
import { computeCheckDigit, isBlank, verifyCheckDigit } from '../checkDigit';

describe('computeCheckDigit', () => {
  it.each([
    ['L898902C3', 6],
    ['740812', 2],
    ['120415', 9],
    ['ZE184226B<<<<<', 1],
    ['520727', 3],
    ['L898902C36' + '7408122' + '120415' + '9ZE184226B<<<<<1', 0],
  ])('matches the ICAO 9303 example %s → %i', (value, expected) => {
    expect(computeCheckDigit(value)).toBe(expected);
  });

  it('values letters 10-35 and fillers 0', () => {
    expect(computeCheckDigit('A')).toBe(0); // 10 × 7 = 70
    expect(computeCheckDigit('B')).toBe(7); // 11 × 7 = 77
    expect(computeCheckDigit('Z')).toBe(5); // 35 × 7 = 245
    expect(computeCheckDigit('<<<')).toBe(0);
    expect(computeCheckDigit('')).toBe(0);
  });

  it('applies the 7-3-1 weights in a repeating cycle', () => {
    // 1×7 + 1×3 + 1×1 + 1×7 = 18
    expect(computeCheckDigit('1111')).toBe(8);
  });

  it.each(['a', ' ', '#', 'É', '\n'])(
    'throws a RangeError for the invalid character %j',
    (character) => {
      expect(() => computeCheckDigit(`12${character}`)).toThrow(RangeError);
    }
  );
});

describe('verifyCheckDigit', () => {
  it('accepts a matching digit', () => {
    expect(verifyCheckDigit('740812', '2')).toEqual({
      computed: 2,
      valid: true,
    });
  });

  it('rejects a different digit', () => {
    expect(verifyCheckDigit('740812', '3')).toEqual({
      computed: 2,
      valid: false,
    });
  });

  it('accepts a filler check character only for blank data when allowed', () => {
    expect(verifyCheckDigit('<<<<', '<', true).valid).toBe(true);
    expect(verifyCheckDigit('<<<<', '<', false).valid).toBe(false);
    expect(verifyCheckDigit('AB<<', '<', true).valid).toBe(false);
  });

  it('still accepts 0 as the check digit for blank data', () => {
    expect(verifyCheckDigit('<<<<', '0', true).valid).toBe(true);
  });
});

describe('isBlank', () => {
  it('is true only for fillers or empty strings', () => {
    expect(isBlank('')).toBe(true);
    expect(isBlank('<<<')).toBe(true);
    expect(isBlank('<A<')).toBe(false);
  });
});
