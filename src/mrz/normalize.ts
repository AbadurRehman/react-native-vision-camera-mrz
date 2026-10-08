import { parseFailure } from './errors';
import type { MrzParseFailure } from './types';

/**
 * Upper bound on input size. The largest MRZ is 90 characters (3 × 30), so this
 * leaves ample room for OCR whitespace while bounding the work done on
 * untrusted input.
 */
export const MAX_INPUT_LENGTH = 1024;

const MRZ_LINE_PATTERN = /^[A-Z0-9<]+$/;
const WHITESPACE = /\s+/g;
const LINE_BREAK = /\r\n|\r|\n/;
/** OCR commonly renders two fillers (`<<`) as a single guillemet. */
const DOUBLE_FILLER_LOOKALIKE = /«/g;
/** Characters OCR returns in place of a single filler (`<`). */
const FILLER_LOOKALIKES = /[‹〈⟨＜]/g;

export interface NormalizedInput {
  readonly ok: true;
  readonly lines: readonly string[];
}

/**
 * Turns raw OCR output into clean MRZ lines: upper case, no whitespace, filler
 * look-alikes replaced, blank lines dropped. Never throws.
 */
export function normalizeMrzInput(
  input: unknown
): NormalizedInput | MrzParseFailure {
  const text = toText(input);
  if (text === null) {
    return parseFailure(
      'INVALID_INPUT',
      'Expected the MRZ as a string or an array of strings.'
    );
  }
  if (text.length > MAX_INPUT_LENGTH) {
    return parseFailure(
      'INVALID_INPUT',
      `Input is longer than ${MAX_INPUT_LENGTH} characters.`
    );
  }

  const lines = text
    .split(LINE_BREAK)
    .map(normalizeLine)
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return parseFailure('INVALID_INPUT', 'Input does not contain any text.');
  }

  const invalidLineIndex = lines.findIndex(
    (line) => !MRZ_LINE_PATTERN.test(line)
  );
  if (invalidLineIndex !== -1) {
    return parseFailure(
      'INVALID_CHARACTERS',
      `Line ${invalidLineIndex + 1} contains characters that cannot appear in an MRZ (allowed: A-Z, 0-9 and <).`
    );
  }

  return { ok: true, lines };
}

function toText(input: unknown): string | null {
  if (typeof input === 'string') {
    return input;
  }
  if (
    Array.isArray(input) &&
    input.every((line): line is string => typeof line === 'string')
  ) {
    return input.join('\n');
  }
  return null;
}

function normalizeLine(line: string): string {
  return line
    .toUpperCase()
    .replace(WHITESPACE, '')
    .replace(DOUBLE_FILLER_LOOKALIKE, '<<')
    .replace(FILLER_LOOKALIKES, '<');
}
