/**
 * Finds a passport (TD3) MRZ in OCR rows and rebuilds both lines to exactly
 * 44 characters. OCR typically drops or adds filler characters (`<`), drops
 * the `<` after `P`, and cuts rows into pieces; the fixed TD3 layout lets most
 * of that be undone, and the check digits on line 2 decide between repairs.
 */
import { correctCharacters } from '../mrz/characterCorrection';
import { FILLER } from '../mrz/checkDigit';
import { isKnownStateCode } from '../mrz/countryCodes';
import { hasValidTd3CheckDigits, TD3_LINE_LENGTH } from '../mrz/formats/td3';
import type { TextRow } from './rows';

export interface MrzCandidate {
  /** Both MRZ lines, 44 characters each. */
  readonly lines: readonly [string, string];
  /** The rows the lines were read from, top to bottom. */
  readonly rows: readonly [TextRow, TextRow];
  /**
   * `true` when every check digit on line 2 matches. Line 1 has no check
   * digits; agreement across frames protects it instead.
   */
  readonly hasValidCheckDigits: boolean;
}

/** Where the nationality sits on line 2. */
const NATIONALITY_START = 10;
const NATIONALITY_END = 13;

/**
 * Searches bottom-up (the MRZ is the last text on the data page) for a row
 * that can be a TD3 line 2 directly below a row that can be a TD3 line 1.
 * A pair whose check digits match is preferred; otherwise the lowest pair is
 * returned so the caller can tell the user an MRZ is in view.
 */
export function findTd3Candidate(
  rows: readonly TextRow[]
): MrzCandidate | null {
  let fallback: MrzCandidate | null = null;
  for (let index = rows.length - 1; index >= 1; index--) {
    const upperRow = rows[index - 1];
    const lowerRow = rows[index];
    if (upperRow === undefined || lowerRow === undefined) {
      continue;
    }
    const line2 = rebuildTd3Line2(lowerRow.text);
    if (line2 === null) {
      continue;
    }
    const nationality = correctCharacters(
      line2.line.slice(NATIONALITY_START, NATIONALITY_END),
      'alphabetic'
    );
    const line1 = rebuildTd3Line1(upperRow.text, nationality);
    if (line1 === null) {
      continue;
    }
    const candidate: MrzCandidate = {
      lines: [line1, line2.line],
      rows: [upperRow, lowerRow],
      hasValidCheckDigits: line2.hasValidCheckDigits,
    };
    if (candidate.hasValidCheckDigits) {
      return candidate;
    }
    fallback ??= candidate;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Line 1: P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<
// ---------------------------------------------------------------------------

const DOCUMENT_CODE = 'P';
/** Document type: a letter or a filler. */
const DOCUMENT_TYPE = /^[A-Z<]$/;
/** Start of a line 1 whose issuing state is not recognized. */
const LINE1_STRUCTURE = /^P[A-Z<][A-Z]/;
const STATE_START = 2;
const STATE_LENGTH = 3;
const LEADING_FILLERS = /^<+/;
const TRAILING_FILLERS = /<+$/;
/**
 * A shorter line 1 is accepted only if it ends in fillers, which shows OCR saw
 * the end of the name field rather than a cut-off row.
 */
const MIN_UNTERMINATED_LINE1_LENGTH = 40;

/**
 * Rebuilds a TD3 line 1, or returns `null` if the row is not one.
 *
 * @param nationality The nationality from line 2. Passports are almost always
 *   issued by the holder's country, so it helps to repair the issuing state.
 */
export function rebuildTd3Line1(
  text: string,
  nationality?: string
): string | null {
  const located = locateTd3Line1(text, nationality);
  if (located === null) {
    return null;
  }
  const line = restoreStateFillers(located, nationality);
  if (line.length < MIN_UNTERMINATED_LINE1_LENGTH && !line.endsWith(FILLER)) {
    return null;
  }
  // Missing characters are almost always fillers at the end of the name field.
  return line.length >= TD3_LINE_LENGTH
    ? line.slice(0, TD3_LINE_LENGTH)
    : line.padEnd(TD3_LINE_LENGTH, FILLER);
}

/**
 * Returns the row from the start of line 1 onwards. The leftmost `P` that is
 * followed by a document type and a recognized issuing state wins; a
 * recognized state directly after `P` means OCR dropped the filler, which is
 * put back.
 */
function locateTd3Line1(text: string, nationality?: string): string | null {
  const isExpectedState = (state: string) =>
    isKnownStateCode(state) ||
    (nationality !== undefined && state === nationality);

  for (
    let start = text.indexOf(DOCUMENT_CODE);
    start !== -1;
    start = text.indexOf(DOCUMENT_CODE, start + 1)
  ) {
    const head = correctCharacters(text.slice(start, start + 5), 'alphabetic');
    if (
      head.length === 5 &&
      DOCUMENT_TYPE.test(head.charAt(1)) &&
      isExpectedState(head.slice(STATE_START))
    ) {
      return text.slice(start);
    }
    const stateAfterCode = head.slice(1, 1 + STATE_LENGTH);
    if (
      stateAfterCode.length === STATE_LENGTH &&
      !stateAfterCode.startsWith(FILLER) &&
      isExpectedState(stateAfterCode)
    ) {
      return `${DOCUMENT_CODE}${FILLER}${text.slice(start + 1)}`;
    }
  }
  return LINE1_STRUCTURE.test(text) ? text : null;
}

/**
 * Puts back fillers OCR dropped after a short issuing state, such as
 * Germany's `D<<`: `P<DMUSTERMANN` becomes `P<D<<MUSTERMANN`. Applied only
 * when line 2 shows the same short code as the nationality, so an unknown
 * state is never turned into a different country.
 */
function restoreStateFillers(line: string, nationality?: string): string {
  const code = nationality?.replace(TRAILING_FILLERS, '');
  if (code === undefined || code.length === 0 || code.length >= STATE_LENGTH) {
    return line;
  }
  const state = line.slice(STATE_START, STATE_START + STATE_LENGTH);
  const paddedCode = code.padEnd(STATE_LENGTH, FILLER);
  if (state === paddedCode || !state.startsWith(code)) {
    return line;
  }
  const name = line
    .slice(STATE_START + code.length)
    .replace(LEADING_FILLERS, '');
  return line.slice(0, STATE_START) + paddedCode + name;
}

// ---------------------------------------------------------------------------
// Line 2: L898902C36UTO7408122F1204159ZE184226B<<<<<10
// ---------------------------------------------------------------------------

/** Document number (9) and its check digit. */
const DOCUMENT_FIELD_LENGTH = 10;
const NATIONALITY_LENGTH = 3;
/** Birth date + check, sex, expiry date + check. */
const DATES_LENGTH = 15;
const DATES_START = DOCUMENT_FIELD_LENGTH + NATIONALITY_LENGTH;
/** Optional data (14), its check digit and the composite check digit. */
const TAIL_LENGTH = 16;
/** Digits plus the letters OCR confuses with them (fixed later by the parser). */
const DIGIT_LIKE = '0-9OQDILZSGB';
const DATES_PATTERN = new RegExp(
  `^[${DIGIT_LIKE}<]{6}[${DIGIT_LIKE}][MFX<][${DIGIT_LIKE}<]{6}[${DIGIT_LIKE}]$`
);
/** Nationality as printed: letters (or digits OCR swapped for them), then fillers. */
const FULL_NATIONALITY = /^[A-Z0-9]{1,3}<*$/;
/** The document number's check digit, as read. */
const CHECK_DIGIT_LIKE = new RegExp(`^[${DIGIT_LIKE}]$`);
const FILLERS = /</g;
const FILLER_RUN = /<+/g;

export interface RebuiltLine2 {
  /** Line 2, 44 characters. */
  readonly line: string;
  /**
   * `true` when this is the only repair whose check digits all match. When
   * two different repairs both pass (rare, but possible by coincidence), the
   * frame is not trusted.
   */
  readonly hasValidCheckDigits: boolean;
}

/**
 * Rebuilds a TD3 line 2, or returns `null` if the row is not one. Of the
 * possible repairs, the one whose check digits all match is returned;
 * otherwise the most likely one, which the parser will report as invalid.
 */
export function rebuildTd3Line2(text: string): RebuiltLine2 | null {
  const candidates = new Set<string>();
  for (const start of findDatesStarts(text)) {
    const dates = text.slice(start, start + DATES_LENGTH);
    const tails = rebuildTail(text.slice(start + DATES_LENGTH));
    for (const head of rebuildHead(text.slice(0, start))) {
      for (const tail of tails) {
        candidates.add(head + dates + tail);
      }
    }
  }
  const all = [...candidates];
  const valid = all.filter(hasValidTd3CheckDigits);
  const line = valid[0] ?? all[0];
  if (line === undefined) {
    return null;
  }
  return { line, hasValidCheckDigits: valid.length === 1 };
}

/** Positions where the fixed-format dates block matches, most likely first. */
function findDatesStarts(text: string): number[] {
  const starts: number[] = [];
  for (let start = 0; start + DATES_LENGTH <= text.length; start++) {
    if (DATES_PATTERN.test(text.slice(start, start + DATES_LENGTH))) {
      starts.push(start);
    }
  }
  return starts.sort(
    (a, b) => Math.abs(a - DATES_START) - Math.abs(b - DATES_START)
  );
}

/**
 * Possible readings of the document number, its check digit and the
 * nationality, as printed first. OCR drops the fillers that pad short values:
 * `C239248<<2` read as `C2392482`, or Germany's `D<<` read as `D`.
 */
function rebuildHead(head: string): string[] {
  const candidates: string[] = [];
  for (let length = NATIONALITY_LENGTH; length >= 1; length--) {
    const nationality = head.slice(-length);
    // A shorter reading means OCR dropped the padding of a short code (D<<).
    const isPlausible =
      nationality.length === length &&
      (length === NATIONALITY_LENGTH
        ? FULL_NATIONALITY.test(nationality)
        : isKnownStateCode(nationality));
    if (!isPlausible) {
      continue;
    }
    const paddedNationality = nationality
      .replace(FILLERS, '')
      .padEnd(NATIONALITY_LENGTH, FILLER);
    for (const documentField of rebuildDocumentField(head.slice(0, -length))) {
      candidates.push(documentField + paddedNationality);
    }
  }
  return candidates;
}

/**
 * Possible readings of the document number field (9 characters and a check
 * digit). Numbers shorter than 9 characters are padded with fillers before
 * the check digit; text in front of the field is unrelated and cut off.
 */
function rebuildDocumentField(prefix: string): string[] {
  if (!CHECK_DIGIT_LIKE.test(prefix.slice(-1))) {
    return [];
  }
  const candidates: string[] = [];
  if (prefix.length >= DOCUMENT_FIELD_LENGTH) {
    candidates.push(prefix.slice(-DOCUMENT_FIELD_LENGTH));
  }
  const withoutFillers = prefix.replace(FILLERS, '');
  if (
    withoutFillers.length >= 2 &&
    withoutFillers.length <= DOCUMENT_FIELD_LENGTH
  ) {
    candidates.push(
      withoutFillers.slice(0, -1).padEnd(DOCUMENT_FIELD_LENGTH - 1, FILLER) +
        withoutFillers.slice(-1)
    );
  }
  return candidates;
}

/** Possible readings of the optional data and the last two check digits. */
function rebuildTail(suffix: string): string[] {
  if (suffix.length === TAIL_LENGTH) {
    return [suffix];
  }
  if (suffix.length < 2) {
    return [];
  }
  const checkDigits = suffix.slice(-2);
  const optionalData = suffix.slice(0, -2);
  if (suffix.length < TAIL_LENGTH) {
    // Fillers trail the optional data, so dropped ones belong at its end.
    return [optionalData.padEnd(TAIL_LENGTH - 2, FILLER) + checkDigits];
  }
  // Too long: OCR repeated fillers, or unrelated text follows the MRZ.
  const candidates = [suffix.slice(0, TAIL_LENGTH)];
  const withoutExtraFillers = removeFillers(
    optionalData,
    suffix.length - TAIL_LENGTH
  );
  if (withoutExtraFillers !== null) {
    candidates.unshift(withoutExtraFillers + checkDigits);
  }
  return candidates;
}

/** Removes `count` fillers from the longest filler run, if it is long enough. */
function removeFillers(value: string, count: number): string | null {
  let longestStart = -1;
  let longestLength = 0;
  for (const match of value.matchAll(FILLER_RUN)) {
    if (match[0].length > longestLength) {
      longestStart = match.index ?? 0;
      longestLength = match[0].length;
    }
  }
  if (longestLength < count) {
    return null;
  }
  return value.slice(0, longestStart) + value.slice(longestStart + count);
}
