/**
 * Test specimens with fictional holders, one per MRZ feature that tends to
 * break scanners. The same MRZs are printed on the specimen images used for
 * testing on phones, so automated tests and device tests use the same data.
 */
export interface Specimen {
  readonly id: string;
  /** What this specimen exercises. */
  readonly feature: string;
  readonly lines: readonly [string, string];
  readonly expected: {
    readonly issuingState: string;
    readonly surname: string;
    readonly givenNames: string;
    readonly documentNumber: string;
    readonly nationality: string;
    readonly dateOfBirth: string;
    readonly sex: 'male' | 'female' | 'unspecified';
    readonly dateOfExpiry: string;
    readonly optionalData: string;
  };
}

export const SPECIMENS: readonly Specimen[] = [
  {
    id: 'utopia',
    feature: 'the ICAO 9303 example, with optional data',
    lines: [
      'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
      'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
    ],
    expected: {
      issuingState: 'UTO',
      surname: 'ERIKSSON',
      givenNames: 'ANNA MARIA',
      documentNumber: 'L898902C3',
      nationality: 'UTO',
      dateOfBirth: '1974-08-12',
      sex: 'female',
      dateOfExpiry: '2012-04-15',
      optionalData: 'ZE184226B',
    },
  },
  {
    id: 'germany',
    feature: 'the one-letter state code D<< and blank optional data',
    lines: [
      'P<D<<MUELLER<<LENA<<<<<<<<<<<<<<<<<<<<<<<<<<',
      'C4J7K2M9X0D<<9003152F3303148<<<<<<<<<<<<<<<2',
    ],
    expected: {
      issuingState: 'D',
      surname: 'MUELLER',
      givenNames: 'LENA',
      documentNumber: 'C4J7K2M9X',
      nationality: 'D',
      dateOfBirth: '1990-03-15',
      sex: 'female',
      dateOfExpiry: '2033-03-14',
      optionalData: '',
    },
  },
  {
    id: 'pakistan',
    feature: 'optional data full of digits (a personal number)',
    lines: [
      'P<PAKAHMED<<SANA<FATIMA<<<<<<<<<<<<<<<<<<<<<',
      'ZZ00012348PAK9507041F31070360000012345678<48',
    ],
    expected: {
      issuingState: 'PAK',
      surname: 'AHMED',
      givenNames: 'SANA FATIMA',
      documentNumber: 'ZZ0001234',
      nationality: 'PAK',
      dateOfBirth: '1995-07-04',
      sex: 'female',
      dateOfExpiry: '2031-07-03',
      optionalData: '0000012345678',
    },
  },
  {
    id: 'united-kingdom',
    feature: 'a hyphenated surname, written with < in the MRZ',
    lines: [
      'P<GBRTAYLOR<BROWN<<OLIVER<JAMES<<<<<<<<<<<<<',
      '1000000579GBR8809210M3409202<<<<<<<<<<<<<<<6',
    ],
    expected: {
      issuingState: 'GBR',
      surname: 'TAYLOR BROWN',
      givenNames: 'OLIVER JAMES',
      documentNumber: '100000057',
      nationality: 'GBR',
      dateOfBirth: '1988-09-21',
      sex: 'male',
      dateOfExpiry: '2034-09-20',
      optionalData: '',
    },
  },
  {
    id: 'united-states',
    feature: 'a leap-day birth date and an all-digit document number',
    lines: [
      'P<USARIVERA<<SAMUEL<<<<<<<<<<<<<<<<<<<<<<<<<',
      '0000000170USA0002299M3502284<<<<<<<<<<<<<<<0',
    ],
    expected: {
      issuingState: 'USA',
      surname: 'RIVERA',
      givenNames: 'SAMUEL',
      documentNumber: '000000017',
      nationality: 'USA',
      dateOfBirth: '2000-02-29',
      sex: 'male',
      dateOfExpiry: '2035-02-28',
      optionalData: '',
    },
  },
  {
    id: 'india',
    feature:
      'an 8-character document number and a name cut off at 39 characters',
    lines: [
      'P<INDVENKATARAMANAN<<SUBRAMANIAM<ARAVINDAKSH',
      'T1234567<9IND8211158M3205208<<<<<<<<<<<<<<<2',
    ],
    expected: {
      issuingState: 'IND',
      surname: 'VENKATARAMANAN',
      givenNames: 'SUBRAMANIAM ARAVINDAKSH',
      documentNumber: 'T1234567',
      nationality: 'IND',
      dateOfBirth: '1982-11-15',
      sex: 'male',
      dateOfExpiry: '2032-05-20',
      optionalData: '',
    },
  },
  {
    id: 'netherlands',
    feature: 'a surname with a particle (DE VRIES) and sex X',
    lines: [
      'P<NLDDE<VRIES<<ANNA<LOTTE<<<<<<<<<<<<<<<<<<<',
      'NX12345678NLD9906127X3606115<<<<<<<<<<<<<<<0',
    ],
    expected: {
      issuingState: 'NLD',
      surname: 'DE VRIES',
      givenNames: 'ANNA LOTTE',
      documentNumber: 'NX1234567',
      nationality: 'NLD',
      dateOfBirth: '1999-06-12',
      sex: 'unspecified',
      dateOfExpiry: '2036-06-11',
      optionalData: '',
    },
  },
];
