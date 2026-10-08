import { parseFailure } from './errors';
import { describeSupportedFormats, findFormat } from './formats';
import { normalizeMrzInput } from './normalize';
import type { MrzParseResult, ParseMrzOptions } from './types';

/**
 * Parses and validates a machine-readable zone.
 *
 * Accepts raw OCR output: case, whitespace and common look-alike characters
 * are cleaned up first. Never throws; malformed input returns `ok: false`.
 *
 * @param input The MRZ as one string with line breaks, or one string per line.
 * @example
 * const result = parseMrz([
 *   'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
 *   'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
 * ]);
 * if (result.ok && result.valid) {
 *   console.log(result.fields.documentNumber); // 'L898902C3'
 * }
 */
export function parseMrz(
  input: string | readonly string[],
  options?: ParseMrzOptions
): MrzParseResult {
  const referenceDate = options?.referenceDate ?? new Date();
  if (
    !(referenceDate instanceof Date) ||
    Number.isNaN(referenceDate.getTime())
  ) {
    return parseFailure(
      'INVALID_INPUT',
      'options.referenceDate must be a valid Date.'
    );
  }

  const normalized = normalizeMrzInput(input);
  if (!normalized.ok) {
    return normalized;
  }

  const { lines } = normalized;
  const format = findFormat(lines);
  if (format === undefined) {
    const lengths = lines.map((line) => line.length).join(', ');
    return parseFailure(
      'UNSUPPORTED_FORMAT',
      `Expected ${describeSupportedFormats()}; got ${lines.length} line(s) with ${lengths} characters.`
    );
  }

  return format.parse(lines, { referenceDate });
}
