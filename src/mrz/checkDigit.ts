/**
 * ICAO 9303 check digits (Doc 9303 Part 3).
 *
 * Each character is converted to a value (0-9 → 0-9, A-Z → 10-35, `<` → 0),
 * multiplied by the repeating weights 7, 3, 1, and the sum is taken modulo 10.
 */

export const FILLER = '<';

const CODE_0 = 48;
const CODE_9 = 57;
const CODE_A = 65;
const CODE_Z = 90;
const CODE_FILLER = 60;
/** Value of `A`; letters map to 10-35. */
const LETTER_OFFSET = CODE_A - 10;

/**
 * Computes the check digit for a run of MRZ characters.
 *
 * @throws {RangeError} If `value` contains a character other than A-Z, 0-9 or `<`.
 * @example computeCheckDigit('L898902C3') // 6
 */
export function computeCheckDigit(value: string): number {
  let sum = 0;
  for (let index = 0; index < value.length; index++) {
    sum += characterValue(value.charCodeAt(index)) * weightAt(index);
  }
  return sum % 10;
}

export interface CheckDigitVerification {
  readonly computed: number;
  readonly valid: boolean;
}

/**
 * Verifies a printed check character against the protected characters.
 *
 * @param fillerAllowedWhenBlank ICAO 9303 lets some optional fields use `<` as
 *   their check character when the field contains only fillers.
 */
export function verifyCheckDigit(
  value: string,
  printed: string,
  fillerAllowedWhenBlank = false
): CheckDigitVerification {
  const computed = computeCheckDigit(value);
  const valid =
    printed === FILLER
      ? fillerAllowedWhenBlank && isBlank(value)
      : printed === String(computed);
  return { computed, valid };
}

/** `true` when the value contains only filler characters (or nothing). */
export function isBlank(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    if (value.charCodeAt(index) !== CODE_FILLER) {
      return false;
    }
  }
  return true;
}

function characterValue(code: number): number {
  if (code >= CODE_0 && code <= CODE_9) {
    return code - CODE_0;
  }
  if (code >= CODE_A && code <= CODE_Z) {
    return code - LETTER_OFFSET;
  }
  if (code === CODE_FILLER) {
    return 0;
  }
  throw new RangeError(
    'MRZ check digits can only be computed over A-Z, 0-9 and <.'
  );
}

function weightAt(index: number): number {
  switch (index % 3) {
    case 0:
      return 7;
    case 1:
      return 3;
    default:
      return 1;
  }
}
