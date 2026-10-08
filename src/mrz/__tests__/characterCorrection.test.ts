import { describe, expect, it } from '@jest/globals';
import { correctCharacters } from '../characterCorrection';

describe('correctCharacters', () => {
  it('turns letter look-alikes into digits in numeric fields', () => {
    expect(correctCharacters('OQDILZSGB', 'numeric')).toBe('000112568');
  });

  it('turns digit look-alikes into letters in alphabetic fields', () => {
    expect(correctCharacters('012568', 'alphabetic')).toBe('OIZSGB');
  });

  it('keeps fillers and characters that are already legal', () => {
    expect(correctCharacters('74<<12', 'numeric')).toBe('74<<12');
    expect(correctCharacters('ANNA<MARIA', 'alphabetic')).toBe('ANNA<MARIA');
  });

  it('leaves characters without a known look-alike for validation to catch', () => {
    expect(correctCharacters('A7', 'numeric')).toBe('A7');
    expect(correctCharacters('E3', 'alphabetic')).toBe('E3');
  });

  it('handles empty input', () => {
    expect(correctCharacters('', 'numeric')).toBe('');
  });
});
