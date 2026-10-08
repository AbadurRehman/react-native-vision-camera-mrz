/**
 * Format-independent helpers for reading fixed-position MRZ fields. Each MRZ
 * format describes its layout with these types, so new formats are added as
 * data rather than new parsing code.
 */
import { correctCharacters, type CharacterClass } from './characterCorrection';
import { verifyCheckDigit } from './checkDigit';
import type { MrzCheckDigit, MrzCheckDigitName } from './types';

/** A run of characters on one MRZ line. `start` is 0-based, `end` is exclusive. */
export interface FieldPosition {
  readonly line: number;
  readonly start: number;
  readonly end: number;
}

export function position(
  line: number,
  start: number,
  end: number
): FieldPosition {
  return { line, start, end };
}

export function readField(
  lines: readonly string[],
  field: FieldPosition
): string {
  return (lines[field.line] ?? '').slice(field.start, field.end);
}

/** A field whose characters must all belong to one character class. */
export interface CorrectionRule {
  readonly field: FieldPosition;
  readonly characterClass: CharacterClass;
}

/** Returns a copy of `lines` with OCR look-alike characters corrected. */
export function applyCorrections(
  lines: readonly string[],
  rules: readonly CorrectionRule[]
): string[] {
  const corrected = [...lines];
  for (const { field, characterClass } of rules) {
    const line = corrected[field.line];
    if (line === undefined) {
      continue;
    }
    corrected[field.line] =
      line.slice(0, field.start) +
      correctCharacters(line.slice(field.start, field.end), characterClass) +
      line.slice(field.end);
  }
  return corrected;
}

export interface CheckDigitRule {
  readonly name: MrzCheckDigitName;
  /** Ranges protected by the check digit, concatenated in this order. */
  readonly protects: readonly FieldPosition[];
  readonly checkDigit: FieldPosition;
  /** Whether `<` is an acceptable check character when the data is all fillers. */
  readonly fillerAllowedWhenBlank?: boolean;
}

/** Lines must contain only A-Z, 0-9 and `<` (see `normalizeMrzInput`). */
export function evaluateCheckDigits(
  lines: readonly string[],
  rules: readonly CheckDigitRule[]
): MrzCheckDigit[] {
  return rules.map((rule) => {
    const protectedValue = rule.protects
      .map((field) => readField(lines, field))
      .join('');
    const printed = readField(lines, rule.checkDigit);
    const { computed, valid } = verifyCheckDigit(
      protectedValue,
      printed,
      rule.fillerAllowedWhenBlank
    );
    return { name: rule.name, printed, computed, valid };
  });
}
