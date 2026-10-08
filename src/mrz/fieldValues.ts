/**
 * Validation and clean-up of individual MRZ values, shared by all formats.
 */
import type { MrzCheckDigitName, MrzFieldName, MrzSex } from './types';

const TRAILING_FILLERS = /<+$/;
/** Letters followed by optional fillers, e.g. `GBR` or `D<<`. */
const CODE_PATTERN = /^[A-Z]+<*$/;
/** Names after parsing: letters, with single spaces between components. */
const NAME_PATTERN = /^[A-Z ]+$/;

export interface FieldValue<T> {
  readonly value: T;
  readonly valid: boolean;
}

export function stripTrailingFillers(value: string): string {
  return value.replace(TRAILING_FILLERS, '');
}

/** Reads a country or organization code such as `GBR` or `D<<`. */
export function readCode(raw: string): FieldValue<string> {
  return { value: stripTrailingFillers(raw), valid: CODE_PATTERN.test(raw) };
}

/** Reads a required alphanumeric value such as a document number. */
export function readRequiredValue(raw: string): FieldValue<string> {
  const value = stripTrailingFillers(raw);
  return { value, valid: value.length > 0 };
}

/** Checks a parsed name (see `parseMrzName`); empty is valid only if optional. */
export function isValidName(name: string, required: boolean): boolean {
  return name.length === 0 ? !required : NAME_PATTERN.test(name);
}

export function readSex(raw: string): FieldValue<MrzSex | null> {
  switch (raw) {
    case 'M':
      return { value: 'male', valid: true };
    case 'F':
      return { value: 'female', valid: true };
    case '<':
    case 'X':
      return { value: 'unspecified', valid: true };
    default:
      return { value: null, valid: false };
  }
}

const LABELS: Readonly<Record<MrzFieldName | MrzCheckDigitName, string>> = {
  documentCode: 'document code',
  issuingState: 'issuing state',
  surname: 'surname',
  givenNames: 'given names',
  documentNumber: 'document number',
  nationality: 'nationality',
  dateOfBirth: 'date of birth',
  sex: 'sex',
  dateOfExpiry: 'date of expiry',
  optionalData: 'optional data',
  composite: 'composite',
};

/** Human-readable field name for issue messages. */
export function fieldLabel(field: MrzFieldName | MrzCheckDigitName): string {
  return LABELS[field];
}
