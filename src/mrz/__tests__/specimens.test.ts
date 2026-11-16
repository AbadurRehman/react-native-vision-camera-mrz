import { describe, expect, it } from '@jest/globals';
import { SPECIMENS } from '../__fixtures__/specimens';
import { parseMrz } from '../parseMrz';

/** 16 November 2026, local time. */
const OPTIONS = { referenceDate: new Date(2026, 10, 16) };

describe('specimen passports', () => {
  it.each(SPECIMENS.map((specimen) => [specimen.id, specimen] as const))(
    'parses the %s specimen',
    (_id, specimen) => {
      const result = parseMrz(specimen.lines, OPTIONS);
      if (!result.ok) {
        throw new Error(`Expected success, got ${result.error.code}`);
      }
      expect(result.issues).toEqual([]);
      expect(result.valid).toBe(true);
      const { fields } = result;
      expect({
        issuingState: fields.issuingState,
        surname: fields.surname,
        givenNames: fields.givenNames,
        documentNumber: fields.documentNumber,
        nationality: fields.nationality,
        dateOfBirth: fields.dateOfBirth.iso,
        sex: fields.sex,
        dateOfExpiry: fields.dateOfExpiry.iso,
        optionalData: fields.optionalData,
      }).toEqual(specimen.expected);
    }
  );
});
