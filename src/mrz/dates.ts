import type { MrzDate } from './types';

/**
 * Which date is being read. Two-digit years are ambiguous, so each kind uses a
 * different rule to pick the century:
 * - `birth`: the most recent year that is not in the future.
 * - `expiry`: the year closest to today, up to {@link MAX_EXPIRY_YEARS_AHEAD} ahead.
 */
export type MrzDateKind = 'birth' | 'expiry';

/**
 * Expiry years further ahead than this are read as the previous century.
 * Passports are valid for at most 10 years; this leaves a wide safety margin.
 */
export const MAX_EXPIRY_YEARS_AHEAD = 20;

export interface ParsedMrzDate {
  readonly date: MrzDate;
  /** `false` when the characters do not form a real calendar date. */
  readonly valid: boolean;
}

type DatePart = number | 'unknown' | 'invalid';

const TWO_DIGITS = /^\d{2}$/;
const UNKNOWN_PART = '<<';

/**
 * Parses a six-character `YYMMDD` MRZ date. Unknown parts (`<<`) are allowed
 * and returned as `null`. Never throws.
 */
export function parseMrzDate(
  raw: string,
  kind: MrzDateKind,
  referenceDate: Date
): ParsedMrzDate {
  const invalid: ParsedMrzDate = {
    date: { raw, year: null, month: null, day: null, iso: null },
    valid: false,
  };
  if (raw.length !== 6) {
    return invalid;
  }

  const yearPart = parsePart(raw.slice(0, 2));
  const monthPart = parsePart(raw.slice(2, 4));
  const dayPart = parsePart(raw.slice(4, 6));
  if (
    yearPart === 'invalid' ||
    monthPart === 'invalid' ||
    dayPart === 'invalid'
  ) {
    return invalid;
  }

  const month = monthPart === 'unknown' ? null : monthPart;
  const day = dayPart === 'unknown' ? null : dayPart;
  const year =
    yearPart === 'unknown'
      ? null
      : resolveYear(yearPart, month, day, kind, referenceDate);

  if (month !== null && (month < 1 || month > 12)) {
    return invalid;
  }
  if (day !== null && (day < 1 || day > daysInMonth(year, month))) {
    return invalid;
  }

  const iso =
    year !== null && month !== null && day !== null
      ? `${year}-${pad(month)}-${pad(day)}`
      : null;

  return { date: { raw, year, month, day, iso }, valid: true };
}

function parsePart(part: string): DatePart {
  if (part === UNKNOWN_PART) {
    return 'unknown';
  }
  return TWO_DIGITS.test(part) ? Number(part) : 'invalid';
}

function resolveYear(
  twoDigitYear: number,
  month: number | null,
  day: number | null,
  kind: MrzDateKind,
  referenceDate: Date
): number {
  const referenceYear = referenceDate.getFullYear();
  const century = referenceYear - (referenceYear % 100);
  const year = century + twoDigitYear;

  if (kind === 'birth') {
    return isAfterReference(year, month, day, referenceDate)
      ? year - 100
      : year;
  }
  return year > referenceYear + MAX_EXPIRY_YEARS_AHEAD ? year - 100 : year;
}

/** Unknown month or day parts never make a date count as "in the future". */
function isAfterReference(
  year: number,
  month: number | null,
  day: number | null,
  referenceDate: Date
): boolean {
  const referenceYear = referenceDate.getFullYear();
  if (year !== referenceYear || month === null) {
    return year > referenceYear;
  }
  const referenceMonth = referenceDate.getMonth() + 1;
  if (month !== referenceMonth || day === null) {
    return month > referenceMonth;
  }
  return day > referenceDate.getDate();
}

/** Days in the month; assumes the most permissive case for unknown parts. */
function daysInMonth(year: number | null, month: number | null): number {
  if (month === null) {
    return 31;
  }
  // 2000 is a leap year, so 29 February is accepted when the year is unknown.
  const calendarYear = year ?? 2000;
  // Day 0 of the next month is the last day of this month.
  return new Date(Date.UTC(calendarYear, month, 0)).getUTCDate();
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
