/**
 * TD3: the passport MRZ, 2 lines × 44 characters (ICAO Doc 9303 Part 4).
 *
 *   P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<
 *   L898902C36UTO7408122F1204159ZE184226B<<<<<10
 */
import { isKnownStateCode } from '../countryCodes';
import { parseMrzDate } from '../dates';
import { parseFailure } from '../errors';
import {
  fieldLabel,
  isValidName,
  readCode,
  type FieldValue,
  readRequiredValue,
  readSex,
  stripTrailingFillers,
} from '../fieldValues';
import {
  applyCorrections,
  evaluateCheckDigits,
  position,
  readField,
  type CheckDigitRule,
  type CorrectionRule,
  type FieldPosition,
} from '../layout';
import { parseMrzName } from '../names';
import type { MrzFields, MrzIssue, MrzParseResult } from '../types';
import type { MrzFormatDefinition, ParseContext } from './definition';

export const TD3_LINE_LENGTH = 44;

const PASSPORT_DOCUMENT_CODE = 'P';
const DOCUMENT_CODE_PATTERN = /^P[A-Z<]$/;

/** Character positions (0-based, end exclusive). */
const FIELDS = {
  documentCode: position(0, 0, 2),
  issuingState: position(0, 2, 5),
  name: position(0, 5, 44),
  documentNumber: position(1, 0, 9),
  documentNumberCheck: position(1, 9, 10),
  nationality: position(1, 10, 13),
  dateOfBirth: position(1, 13, 19),
  dateOfBirthCheck: position(1, 19, 20),
  sex: position(1, 20, 21),
  dateOfExpiry: position(1, 21, 27),
  dateOfExpiryCheck: position(1, 27, 28),
  optionalData: position(1, 28, 42),
  optionalDataCheck: position(1, 42, 43),
  compositeCheck: position(1, 43, 44),
} as const satisfies Record<string, FieldPosition>;

const CORRECTIONS: readonly CorrectionRule[] = [
  ...[
    FIELDS.documentCode,
    FIELDS.issuingState,
    FIELDS.name,
    FIELDS.nationality,
  ].map((field) => ({ field, characterClass: 'alphabetic' as const })),
  ...[
    FIELDS.documentNumberCheck,
    FIELDS.dateOfBirth,
    FIELDS.dateOfBirthCheck,
    FIELDS.dateOfExpiry,
    FIELDS.dateOfExpiryCheck,
    FIELDS.optionalDataCheck,
    FIELDS.compositeCheck,
  ].map((field) => ({ field, characterClass: 'numeric' as const })),
];

const CHECK_DIGITS: readonly CheckDigitRule[] = [
  {
    name: 'documentNumber',
    protects: [FIELDS.documentNumber],
    checkDigit: FIELDS.documentNumberCheck,
  },
  {
    name: 'dateOfBirth',
    protects: [FIELDS.dateOfBirth],
    checkDigit: FIELDS.dateOfBirthCheck,
  },
  {
    name: 'dateOfExpiry',
    protects: [FIELDS.dateOfExpiry],
    checkDigit: FIELDS.dateOfExpiryCheck,
  },
  {
    name: 'optionalData',
    protects: [FIELDS.optionalData],
    checkDigit: FIELDS.optionalDataCheck,
    fillerAllowedWhenBlank: true,
  },
  {
    name: 'composite',
    // Document number + check, birth date + check, expiry date + check,
    // optional data + check (line 2, positions 1-10, 14-20 and 22-43).
    protects: [position(1, 0, 10), position(1, 13, 20), position(1, 21, 43)],
    checkDigit: FIELDS.compositeCheck,
  },
];

function parseTd3(
  inputLines: readonly string[],
  context: ParseContext
): MrzParseResult {
  const lines = applyCorrections(inputLines, CORRECTIONS);
  const read = (field: FieldPosition) => readField(lines, field);

  const rawDocumentCode = read(FIELDS.documentCode);
  if (!rawDocumentCode.startsWith(PASSPORT_DOCUMENT_CODE)) {
    return parseFailure(
      'UNSUPPORTED_DOCUMENT_TYPE',
      'Only passports (document code P) are supported in the 2 × 44 layout.'
    );
  }

  const issues: MrzIssue[] = [];
  const invalidValue = (field: MrzIssue['field']) =>
    issues.push({
      code: 'INVALID_VALUE',
      field,
      message: `The ${fieldLabel(field)} is not a valid MRZ value.`,
    });
  const invalidDate = (field: MrzIssue['field']) =>
    issues.push({
      code: 'INVALID_DATE',
      field,
      message: `The ${fieldLabel(field)} is not a real calendar date.`,
    });
  const checkStateCode = (
    field: 'issuingState' | 'nationality',
    code: FieldValue<string>
  ) => {
    if (!code.valid) {
      invalidValue(field);
    } else if (!isKnownStateCode(code.value)) {
      issues.push({
        code: 'UNKNOWN_CODE',
        field,
        message: `The ${fieldLabel(field)} is not a known country or organization code.`,
      });
    }
  };

  if (!DOCUMENT_CODE_PATTERN.test(rawDocumentCode)) {
    invalidValue('documentCode');
  }

  const issuingState = readCode(read(FIELDS.issuingState));
  checkStateCode('issuingState', issuingState);

  const name = parseMrzName(read(FIELDS.name));
  if (!isValidName(name.surname, true)) {
    invalidValue('surname');
  }
  if (!isValidName(name.givenNames, false)) {
    invalidValue('givenNames');
  }

  const documentNumber = readRequiredValue(read(FIELDS.documentNumber));
  if (!documentNumber.valid) {
    invalidValue('documentNumber');
  }

  const nationality = readCode(read(FIELDS.nationality));
  checkStateCode('nationality', nationality);

  const dateOfBirth = parseMrzDate(
    read(FIELDS.dateOfBirth),
    'birth',
    context.referenceDate
  );
  if (!dateOfBirth.valid) {
    invalidDate('dateOfBirth');
  }

  const sex = readSex(read(FIELDS.sex));
  if (!sex.valid) {
    invalidValue('sex');
  }

  const dateOfExpiry = parseMrzDate(
    read(FIELDS.dateOfExpiry),
    'expiry',
    context.referenceDate
  );
  if (!dateOfExpiry.valid) {
    invalidDate('dateOfExpiry');
  }

  const checkDigits = evaluateCheckDigits(lines, CHECK_DIGITS);
  for (const checkDigit of checkDigits) {
    if (!checkDigit.valid) {
      issues.push({
        code: 'CHECK_DIGIT_MISMATCH',
        field: checkDigit.name,
        message: `The ${fieldLabel(checkDigit.name)} check digit does not match.`,
      });
    }
  }

  const fields: MrzFields = {
    documentType: 'passport',
    documentCode: stripTrailingFillers(rawDocumentCode),
    issuingState: issuingState.value,
    surname: name.surname,
    givenNames: name.givenNames,
    documentNumber: documentNumber.value,
    nationality: nationality.value,
    dateOfBirth: dateOfBirth.date,
    sex: sex.value,
    dateOfExpiry: dateOfExpiry.date,
    optionalData: stripTrailingFillers(read(FIELDS.optionalData)),
  };

  return {
    ok: true,
    format: 'TD3',
    valid: issues.length === 0,
    fields,
    checkDigits,
    issues,
    lines,
  };
}

export const td3: MrzFormatDefinition = {
  format: 'TD3',
  lineCount: 2,
  lineLength: TD3_LINE_LENGTH,
  parse: parseTd3,
};

/**
 * `true` when every check digit on a TD3 second line matches. All check digits
 * live on line 2, so this can rank OCR repair candidates before parsing.
 * The line must be 44 characters of A-Z, 0-9 and `<`.
 */
export function hasValidTd3CheckDigits(line2: string): boolean {
  const lines = applyCorrections(['', line2], CORRECTIONS);
  return evaluateCheckDigits(lines, CHECK_DIGITS).every(
    (checkDigit) => checkDigit.valid
  );
}
