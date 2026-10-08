import { describe, expect, it } from '@jest/globals';
import {
  buildTd3,
  GERMAN_SPECIMEN,
  ICAO_SPECIMEN,
  replaceAt,
} from '../__fixtures__/td3';
import { parseMrz } from '../parseMrz';
import type {
  MrzCheckDigitName,
  MrzParseFailure,
  MrzParseResult,
  MrzParseSuccess,
  MrzSex,
  ParseMrzOptions,
} from '../types';

/** 8 October 2026, local time. */
const OPTIONS: ParseMrzOptions = { referenceDate: new Date(2026, 9, 8) };

function parse(input: unknown): MrzParseResult {
  return parseMrz(input as readonly string[], OPTIONS);
}

function expectSuccess(result: MrzParseResult): MrzParseSuccess {
  if (!result.ok) {
    throw new Error(`Expected success, got ${result.error.code}`);
  }
  return result;
}

function expectFailure(result: MrzParseResult): MrzParseFailure {
  if (result.ok) {
    throw new Error('Expected failure, got success');
  }
  return result;
}

const issueSummary = (result: MrzParseSuccess) =>
  result.issues.map(({ code, field }) => `${code}:${field}`);

describe('parseMrz (TD3 passports)', () => {
  describe('valid specimens', () => {
    it('parses the ICAO 9303 specimen', () => {
      const result = expectSuccess(parse(ICAO_SPECIMEN));

      expect(result).toMatchObject({ format: 'TD3', valid: true, issues: [] });
      expect(result.lines).toEqual(ICAO_SPECIMEN);
      expect(result.fields).toEqual({
        documentType: 'passport',
        documentCode: 'P',
        issuingState: 'UTO',
        surname: 'ERIKSSON',
        givenNames: 'ANNA MARIA',
        documentNumber: 'L898902C3',
        nationality: 'UTO',
        dateOfBirth: {
          raw: '740812',
          year: 1974,
          month: 8,
          day: 12,
          iso: '1974-08-12',
        },
        sex: 'female',
        dateOfExpiry: {
          raw: '120415',
          year: 2012,
          month: 4,
          day: 15,
          iso: '2012-04-15',
        },
        optionalData: 'ZE184226B',
      });
      expect(result.checkDigits).toEqual([
        { name: 'documentNumber', printed: '6', computed: 6, valid: true },
        { name: 'dateOfBirth', printed: '2', computed: 2, valid: true },
        { name: 'dateOfExpiry', printed: '9', computed: 9, valid: true },
        { name: 'optionalData', printed: '1', computed: 1, valid: true },
        { name: 'composite', printed: '0', computed: 0, valid: true },
      ]);
    });

    it('parses a one-letter state code and blank optional data', () => {
      const result = expectSuccess(parse(GERMAN_SPECIMEN));

      expect(result.valid).toBe(true);
      expect(result.fields).toMatchObject({
        issuingState: 'D',
        nationality: 'D',
        surname: 'MUSTERMANN',
        givenNames: 'ERIKA',
        documentNumber: 'C01X00T47',
        optionalData: '',
      });
      expect(result.fields.dateOfBirth.iso).toBe('1964-08-12');
      expect(result.fields.dateOfExpiry.iso).toBe('2027-02-28');
      expect(result.checkDigits[3]).toEqual({
        name: 'optionalData',
        printed: '<',
        computed: 0,
        valid: true,
      });
    });

    it('does not treat an expired passport as invalid', () => {
      // The ICAO specimen expired in 2012; expiry is the caller's decision.
      expect(expectSuccess(parse(ICAO_SPECIMEN)).valid).toBe(true);
    });
  });

  describe('input formats', () => {
    it('accepts a single string with line breaks', () => {
      expect(expectSuccess(parse(ICAO_SPECIMEN.join('\r\n'))).valid).toBe(true);
    });

    it('cleans up OCR whitespace, case and filler look-alikes', () => {
      const noisy = [
        `  ${ICAO_SPECIMEN[0].toLowerCase().replace('<<', '«')}  `,
        ICAO_SPECIMEN[1].replace('7408122', '740 812 2'),
      ];
      const result = expectSuccess(parse(noisy));
      expect(result.valid).toBe(true);
      expect(result.lines).toEqual(ICAO_SPECIMEN);
    });
  });

  describe('OCR character correction', () => {
    it('fixes letters read in numeric fields', () => {
      // Date of birth 740812 read as 74O8I2, check digit 2 read as Z.
      const ocr = [
        ICAO_SPECIMEN[0],
        ICAO_SPECIMEN[1].replace('7408122', '74O8I2Z'),
      ];
      const result = expectSuccess(parse(ocr));
      expect(result.valid).toBe(true);
      expect(result.lines).toEqual(ICAO_SPECIMEN);
    });

    it('fixes digits read in alphabetic fields', () => {
      const ocr = [
        ICAO_SPECIMEN[0].replace('UTOERIKSSON', 'UT0ERIKSS0N'),
        ICAO_SPECIMEN[1].replace('6UTO', '6UT0'),
      ];
      const result = expectSuccess(parse(ocr));
      expect(result.valid).toBe(true);
      expect(result.fields).toMatchObject({
        issuingState: 'UTO',
        nationality: 'UTO',
        surname: 'ERIKSSON',
      });
    });

    it('never changes the alphanumeric document number', () => {
      // 0 read as O: both are legal in a document number, so it is not guessed.
      const ocr = replaceAt(ICAO_SPECIMEN, 1, 5, 'O');
      const result = expectSuccess(parse(ocr));
      expect(result.fields.documentNumber).toBe('L8989O2C3');
      expect(result.valid).toBe(false);
      expect(issueSummary(result)).toEqual([
        'CHECK_DIGIT_MISMATCH:documentNumber',
        'CHECK_DIGIT_MISMATCH:composite',
      ]);
    });
  });

  describe('check digits', () => {
    // Each position changes a digit without creating an impossible date.
    const misreads: Array<[number, MrzCheckDigitName]> = [
      [1, 'documentNumber'],
      [18, 'dateOfBirth'],
      [24, 'dateOfExpiry'],
      [30, 'optionalData'],
    ];
    it.each(misreads)(
      'reports a misread at position %i as a %s and composite mismatch',
      (index, field) => {
        const original = ICAO_SPECIMEN[1].charAt(index);
        const misread = original === '9' ? '8' : '9';
        const result = expectSuccess(
          parse(replaceAt(ICAO_SPECIMEN, 1, index, misread))
        );
        expect(result.valid).toBe(false);
        expect(issueSummary(result)).toEqual([
          `CHECK_DIGIT_MISMATCH:${field}`,
          'CHECK_DIGIT_MISMATCH:composite',
        ]);
      }
    );

    it('reports a wrong composite check digit on its own', () => {
      const result = expectSuccess(parse(replaceAt(ICAO_SPECIMEN, 1, 43, '5')));
      expect(issueSummary(result)).toEqual(['CHECK_DIGIT_MISMATCH:composite']);
    });

    it('rejects a filler check digit when the optional data is not blank', () => {
      const result = expectSuccess(parse(replaceAt(ICAO_SPECIMEN, 1, 42, '<')));
      expect(issueSummary(result)).toContain(
        'CHECK_DIGIT_MISMATCH:optionalData'
      );
    });

    it('still returns the fields so callers can show what was read', () => {
      // Expiry 120415 misread as 120416.
      const result = expectSuccess(parse(replaceAt(ICAO_SPECIMEN, 1, 26, '6')));
      expect(result.valid).toBe(false);
      expect(result.fields.dateOfExpiry.iso).toBe('2012-04-16');
    });
  });

  describe('field validation', () => {
    const sexes: Array<[string, MrzSex]> = [
      ['M', 'male'],
      ['F', 'female'],
      ['<', 'unspecified'],
      ['X', 'unspecified'],
    ];
    it.each(sexes)('reads sex %s as %s', (sex, expected) => {
      const result = expectSuccess(parse(buildTd3({ sex })));
      expect(result.valid).toBe(true);
      expect(result.fields.sex).toBe(expected);
    });

    it('reports an invalid sex character', () => {
      const result = expectSuccess(parse(buildTd3({ sex: 'K' })));
      expect(result.fields.sex).toBeNull();
      expect(issueSummary(result)).toEqual(['INVALID_VALUE:sex']);
    });

    it('reports a date that does not exist even when its check digit matches', () => {
      const result = expectSuccess(parse(buildTd3({ dateOfBirth: '740231' })));
      expect(issueSummary(result)).toEqual(['INVALID_DATE:dateOfBirth']);
      expect(result.fields.dateOfBirth).toEqual({
        raw: '740231',
        year: null,
        month: null,
        day: null,
        iso: null,
      });
    });

    it('reports an expiry date that does not exist', () => {
      const result = expectSuccess(parse(buildTd3({ dateOfExpiry: '121301' })));
      expect(issueSummary(result)).toEqual(['INVALID_DATE:dateOfExpiry']);
      expect(result.fields.dateOfExpiry.iso).toBeNull();
    });

    it('accepts an unknown day and month of birth', () => {
      const result = expectSuccess(parse(buildTd3({ dateOfBirth: '74<<<<' })));
      expect(result.valid).toBe(true);
      expect(result.fields.dateOfBirth).toMatchObject({
        year: 1974,
        month: null,
        day: null,
        iso: null,
      });
    });

    it('resolves two-digit years against the reference date', () => {
      const result = expectSuccess(
        parse(buildTd3({ dateOfBirth: '300101', dateOfExpiry: '360101' }))
      );
      expect(result.fields.dateOfBirth.year).toBe(1930);
      expect(result.fields.dateOfExpiry.year).toBe(2036);
    });

    it.each([
      [{ nationality: '<<<' }, 'INVALID_VALUE:nationality'],
      [{ nationality: 'G<R' }, 'INVALID_VALUE:nationality'],
      [{ issuingState: '<<<' }, 'INVALID_VALUE:issuingState'],
      [{ documentCode: 'P7' }, 'INVALID_VALUE:documentCode'],
      [{ documentNumber: '' }, 'INVALID_VALUE:documentNumber'],
      [{ name: '<<ANNA' }, 'INVALID_VALUE:surname'],
      [{ name: 'ERIK7SON<<ANNA' }, 'INVALID_VALUE:surname'],
      [{ name: 'ERIKSSON<<AN4A' }, 'INVALID_VALUE:givenNames'],
    ])('reports %j as %s', (overrides, expected) => {
      const result = expectSuccess(parse(buildTd3(overrides)));
      expect(result.valid).toBe(false);
      expect(issueSummary(result)).toEqual([expected]);
    });

    it('accepts a holder with only one name', () => {
      const result = expectSuccess(parse(buildTd3({ name: 'NEWTON' })));
      expect(result.valid).toBe(true);
      expect(result.fields).toMatchObject({
        surname: 'NEWTON',
        givenNames: '',
      });
    });

    it('keeps the second character of the document code', () => {
      const result = expectSuccess(parse(buildTd3({ documentCode: 'PD' })));
      expect(result.valid).toBe(true);
      expect(result.fields.documentCode).toBe('PD');
    });
  });

  describe('failures', () => {
    it('rejects other 2 × 44 documents such as visas', () => {
      const visa = buildTd3({ documentCode: 'V' });
      expect(expectFailure(parse(visa)).error.code).toBe(
        'UNSUPPORTED_DOCUMENT_TYPE'
      );
    });

    it.each([
      ['a short line', [ICAO_SPECIMEN[0], ICAO_SPECIMEN[1].slice(0, 43)]],
      ['a long line', [ICAO_SPECIMEN[0] + '<', ICAO_SPECIMEN[1]]],
      ['one line', [ICAO_SPECIMEN[1]]],
      ['three lines', [...ICAO_SPECIMEN, ICAO_SPECIMEN[1]]],
      [
        'a TD1 ID card',
        ['I<UTO'.padEnd(30, '<'), '7'.repeat(30), 'A'.repeat(30)],
      ],
    ])('rejects %s as an unsupported format', (_description, lines) => {
      const failure = expectFailure(parse(lines));
      expect(failure.error.code).toBe('UNSUPPORTED_FORMAT');
      expect(failure.error.message).toContain('TD3 (2 lines of 44 characters)');
    });

    it('rejects characters that cannot appear in an MRZ', () => {
      const lines = [
        ICAO_SPECIMEN[0].replace('ANNA', 'ANNÉ'),
        ICAO_SPECIMEN[1],
      ];
      expect(expectFailure(parse(lines)).error.code).toBe('INVALID_CHARACTERS');
    });

    it.each([null, undefined, 42, {}, [ICAO_SPECIMEN[0], 7], '', []])(
      'rejects %j without throwing',
      (input) => {
        expect(expectFailure(parse(input)).error.code).toBe('INVALID_INPUT');
      }
    );

    it.each([new Date('not a date'), '2026-10-08', 0])(
      'rejects the reference date %j',
      (referenceDate) => {
        const result = parseMrz(ICAO_SPECIMEN, {
          referenceDate: referenceDate as Date,
        });
        expect(expectFailure(result).error.code).toBe('INVALID_INPUT');
      }
    );

    it('defaults the reference date to today', () => {
      expect(expectSuccess(parseMrz(ICAO_SPECIMEN)).valid).toBe(true);
    });
  });

  describe('privacy', () => {
    it('never puts MRZ content in error or issue messages', () => {
      const personalData = ['ERIKSSON', 'ANNA', 'L898902C3', '740812', 'ZE184'];
      const results = [
        parse([ICAO_SPECIMEN[0], ICAO_SPECIMEN[1].slice(0, 40)]),
        parse(buildTd3({ name: 'ERIKSSON<<ANNA', documentCode: 'V' })),
        parse(replaceAt(ICAO_SPECIMEN, 1, 1, '9')),
        parse(buildTd3({ dateOfBirth: '740231', sex: 'K' })),
      ];
      const messages = results.flatMap((result) =>
        result.ok
          ? result.issues.map((issue) => issue.message)
          : [result.error.message]
      );
      expect(messages.length).toBeGreaterThan(0);
      for (const message of messages) {
        for (const value of personalData) {
          expect(message).not.toContain(value);
        }
      }
    });
  });
});
