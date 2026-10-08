import { computeCheckDigit } from '../checkDigit';

/** Specimen from ICAO Doc 9303 Part 4 (fictional state "Utopia"). */
export const ICAO_SPECIMEN = [
  'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
  'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
] as const;

/**
 * German specimen passport ("Erika Mustermann"). Covers a one-letter state
 * code (`D<<`) and a filler check digit for blank optional data.
 */
export const GERMAN_SPECIMEN = [
  'P<D<<MUSTERMANN<<ERIKA<<<<<<<<<<<<<<<<<<<<<<',
  'C01X00T478D<<6408125F2702283<<<<<<<<<<<<<<<4',
] as const;

export interface Td3Data {
  documentCode: string;
  issuingState: string;
  name: string;
  documentNumber: string;
  nationality: string;
  dateOfBirth: string;
  sex: string;
  dateOfExpiry: string;
  optionalData: string;
}

const DEFAULTS: Td3Data = {
  documentCode: 'P',
  issuingState: 'UTO',
  name: 'ERIKSSON<<ANNA<MARIA',
  documentNumber: 'L898902C3',
  nationality: 'UTO',
  dateOfBirth: '740812',
  sex: 'F',
  dateOfExpiry: '120415',
  optionalData: 'ZE184226B',
};

/** Builds a TD3 MRZ with correct check digits, for testing one field at a time. */
export function buildTd3(overrides: Partial<Td3Data> = {}): [string, string] {
  const data = { ...DEFAULTS, ...overrides };
  const documentNumber = fit(data.documentNumber, 9);
  const dateOfBirth = fit(data.dateOfBirth, 6);
  const dateOfExpiry = fit(data.dateOfExpiry, 6);
  const optionalData = fit(data.optionalData, 14);

  const documentNumberPart = documentNumber + computeCheckDigit(documentNumber);
  const dateOfBirthPart = dateOfBirth + computeCheckDigit(dateOfBirth);
  const dateOfExpiryPart = dateOfExpiry + computeCheckDigit(dateOfExpiry);
  const optionalDataPart = optionalData + computeCheckDigit(optionalData);
  const composite = computeCheckDigit(
    documentNumberPart + dateOfBirthPart + dateOfExpiryPart + optionalDataPart
  );

  const line1 =
    fit(data.documentCode, 2) + fit(data.issuingState, 3) + fit(data.name, 39);
  const line2 =
    documentNumberPart +
    fit(data.nationality, 3) +
    dateOfBirthPart +
    fit(data.sex, 1) +
    dateOfExpiryPart +
    optionalDataPart +
    composite;
  return [line1, line2];
}

/** Replaces the character at `index` on one line (to simulate an OCR error). */
export function replaceAt(
  lines: readonly string[],
  lineIndex: number,
  index: number,
  replacement: string
): string[] {
  return lines.map((line, i) =>
    i === lineIndex
      ? line.slice(0, index) + replacement + line.slice(index + 1)
      : line
  );
}

function fit(value: string, width: number): string {
  if (value.length > width) {
    throw new Error(`Fixture value is longer than ${width} characters.`);
  }
  return value.padEnd(width, '<');
}
