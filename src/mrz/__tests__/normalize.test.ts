import { describe, expect, it } from '@jest/globals';
import { MAX_INPUT_LENGTH, normalizeMrzInput } from '../normalize';

describe('normalizeMrzInput', () => {
  it('splits a string on any line break and drops blank lines', () => {
    expect(normalizeMrzInput('\nAB<\r\nCD<\rEF\n\n')).toEqual({
      ok: true,
      lines: ['AB<', 'CD<', 'EF'],
    });
  });

  it('accepts one string per line, including strings with line breaks', () => {
    expect(normalizeMrzInput(['AB<', 'CD\nEF'])).toEqual({
      ok: true,
      lines: ['AB<', 'CD', 'EF'],
    });
  });

  it('upper-cases and removes all whitespace', () => {
    expect(normalizeMrzInput(' p<u to\terik ')).toEqual({
      ok: true,
      lines: ['P<UTOERIK'],
    });
  });

  it('replaces filler look-alikes', () => {
    expect(normalizeMrzInput('A«B‹C〈D⟨E＜F')).toEqual({
      ok: true,
      lines: ['A<<B<C<D<E<F'],
    });
  });

  it.each([null, undefined, 42, {}, ['AB', 1], [null]])(
    'rejects %j as invalid input without throwing',
    (input) => {
      expect(normalizeMrzInput(input)).toMatchObject({
        ok: false,
        error: { code: 'INVALID_INPUT' },
      });
    }
  );

  it.each(['', '   ', '\n\n', []])('rejects empty input %j', (input) => {
    expect(normalizeMrzInput(input)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });
  });

  it(`accepts up to ${MAX_INPUT_LENGTH} characters and rejects more`, () => {
    expect(normalizeMrzInput('A'.repeat(MAX_INPUT_LENGTH)).ok).toBe(true);
    expect(normalizeMrzInput('A'.repeat(MAX_INPUT_LENGTH + 1))).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });
  });

  it('reports the line with characters that cannot appear in an MRZ', () => {
    const result = normalizeMrzInput(['P<UTO', 'L89#902']);
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'INVALID_CHARACTERS' },
    });
    if (!result.ok) {
      expect(result.error.message).toContain('Line 2');
      expect(result.error.message).not.toContain('L89');
    }
  });
});
