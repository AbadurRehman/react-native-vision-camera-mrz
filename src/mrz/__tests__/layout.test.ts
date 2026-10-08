import { describe, expect, it } from '@jest/globals';
import {
  applyCorrections,
  evaluateCheckDigits,
  position,
  readField,
} from '../layout';

const LINES = ['AB0D', '74O8I2'] as const;

describe('readField', () => {
  it('reads a run of characters from one line', () => {
    expect(readField(LINES, position(1, 0, 3))).toBe('74O');
  });

  it('returns an empty string for a line that does not exist', () => {
    expect(readField(LINES, position(5, 0, 3))).toBe('');
  });
});

describe('applyCorrections', () => {
  it('corrects only the given ranges and leaves the input untouched', () => {
    const corrected = applyCorrections(LINES, [
      { field: position(0, 2, 3), characterClass: 'alphabetic' },
      { field: position(1, 0, 6), characterClass: 'numeric' },
    ]);
    expect(corrected).toEqual(['ABOD', '740812']);
    expect(LINES).toEqual(['AB0D', '74O8I2']);
  });

  it('ignores rules for lines that do not exist', () => {
    const corrected = applyCorrections(LINES, [
      { field: position(9, 0, 2), characterClass: 'numeric' },
    ]);
    expect(corrected).toEqual([...LINES]);
  });
});

describe('evaluateCheckDigits', () => {
  it('joins protected ranges in order before computing', () => {
    // '740812' → 2, split across two ranges.
    const lines = ['7408', '122'];
    expect(
      evaluateCheckDigits(lines, [
        {
          name: 'dateOfBirth',
          protects: [position(0, 0, 4), position(1, 0, 2)],
          checkDigit: position(1, 2, 3),
        },
      ])
    ).toEqual([
      { name: 'dateOfBirth', printed: '2', computed: 2, valid: true },
    ]);
  });
});
