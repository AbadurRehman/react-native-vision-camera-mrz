/**
 * Public types for the MRZ parser.
 *
 * Results contain personal data (names, dates of birth, document numbers).
 * Never log or send them anywhere without the document holder's consent.
 */

/** MRZ layouts the parser understands. */
export type MrzFormat = 'TD3';

/** Kind of travel document, derived from the document code. */
export type MrzDocumentType = 'passport';

/** Sex as printed in the MRZ. `unspecified` covers `<` and `X`. */
export type MrzSex = 'male' | 'female' | 'unspecified';

/** A date from the MRZ (printed as `YYMMDD`). */
export interface MrzDate {
  /** The six characters as printed. `<` marks an unknown part. */
  readonly raw: string;
  /** Four-digit year with the century resolved, or `null` if unknown or invalid. */
  readonly year: number | null;
  /** Month (1-12), or `null` if unknown or invalid. */
  readonly month: number | null;
  /** Day of the month (1-31), or `null` if unknown or invalid. */
  readonly day: number | null;
  /** `YYYY-MM-DD` when the full date is known and valid, otherwise `null`. */
  readonly iso: string | null;
}

/** Values read from the MRZ. Filler characters (`<`) are removed. */
export interface MrzFields {
  readonly documentType: MrzDocumentType;
  /** Document code as printed, e.g. `P` or `PD`. */
  readonly documentCode: string;
  /** Issuing state or organization code, e.g. `GBR`, `PAK` or `D` (Germany). */
  readonly issuingState: string;
  /** Primary identifier. Name components are separated by single spaces. */
  readonly surname: string;
  /** Secondary identifier. Empty when the holder has only one name. */
  readonly givenNames: string;
  readonly documentNumber: string;
  /** Nationality code, e.g. `GBR`, `PAK` or `D` (Germany). */
  readonly nationality: string;
  readonly dateOfBirth: MrzDate;
  /** `null` when the sex character is not a valid MRZ value. */
  readonly sex: MrzSex | null;
  readonly dateOfExpiry: MrzDate;
  /** Personal number or other optional data. Empty when unused. */
  readonly optionalData: string;
}

/** Names of the values in {@link MrzFields} that can be reported as invalid. */
export type MrzFieldName = Exclude<keyof MrzFields, 'documentType'>;

/** Groups of characters protected by a check digit. */
export type MrzCheckDigitName =
  | 'documentNumber'
  | 'dateOfBirth'
  | 'dateOfExpiry'
  | 'optionalData'
  | 'composite';

/** Outcome of verifying one check digit. */
export interface MrzCheckDigit {
  readonly name: MrzCheckDigitName;
  /** The check character printed on the document. */
  readonly printed: string;
  /** The check digit computed from the protected characters. */
  readonly computed: number;
  readonly valid: boolean;
}

export type MrzIssueCode =
  'CHECK_DIGIT_MISMATCH' | 'INVALID_DATE' | 'INVALID_VALUE';

/** A problem found in an MRZ that was read but did not fully validate. */
export interface MrzIssue {
  readonly code: MrzIssueCode;
  readonly field: MrzFieldName | MrzCheckDigitName;
  /** Human-readable explanation. Never contains MRZ content. */
  readonly message: string;
}

/** The input was read as an MRZ. Check `valid` before trusting the fields. */
export interface MrzParseSuccess {
  readonly ok: true;
  readonly format: MrzFormat;
  /** `true` when every check digit matches and every field holds a valid value. */
  readonly valid: boolean;
  readonly fields: MrzFields;
  readonly checkDigits: readonly MrzCheckDigit[];
  /** Empty when `valid` is `true`. */
  readonly issues: readonly MrzIssue[];
  /** The MRZ lines after normalization and OCR character correction. */
  readonly lines: readonly string[];
}

export type MrzParseErrorCode =
  /** Input is not a string or list of strings, is too long, or options are invalid. */
  | 'INVALID_INPUT'
  /** Input contains characters that cannot appear in an MRZ. */
  | 'INVALID_CHARACTERS'
  /** Line count or line length does not match a supported MRZ format. */
  | 'UNSUPPORTED_FORMAT'
  /** Layout matches, but the document type is not supported (e.g. a visa). */
  | 'UNSUPPORTED_DOCUMENT_TYPE';

/** The input could not be read as a supported MRZ. */
export interface MrzParseFailure {
  readonly ok: false;
  readonly error: {
    readonly code: MrzParseErrorCode;
    /** Human-readable explanation. Never contains MRZ content. */
    readonly message: string;
  };
}

export type MrzParseResult = MrzParseSuccess | MrzParseFailure;

export interface ParseMrzOptions {
  /**
   * The date treated as "today" when turning two-digit years into full years.
   * Defaults to the current date. Pass a fixed date for reproducible results.
   */
  readonly referenceDate?: Date;
}
