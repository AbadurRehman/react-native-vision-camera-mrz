import { describe, expect, it } from '@jest/globals';
import { cleanOcrText, isMrzLikeText } from '../ocrText';

describe('cleanOcrText', () => {
  it('upper-cases and removes everything that cannot be in an MRZ', () => {
    expect(cleanOcrText(' p<uto: erik*sson. ')).toBe('P<UTOERIKSSON');
  });

  it('replaces filler look-alikes', () => {
    expect(cleanOcrText('A«B‹C〈D⟨E＜F')).toBe('A<<B<C<D<E<F');
  });

  it('turns a lone K inside a filler run back into a filler', () => {
    expect(cleanOcrText('MARIA<<<K<<<<K<<')).toBe('MARIA<<<<<<<<<<<');
  });

  it('keeps a K that belongs to a name', () => {
    expect(cleanOcrText('KIM<<KAREN<<<')).toBe('KIM<<KAREN<<<');
    expect(cleanOcrText('ANNAK<<<<')).toBe('ANNAK<<<<');
  });

  it('returns an empty string for text without MRZ characters', () => {
    expect(cleanOcrText('—, .:')).toBe('');
  });
});

describe('isMrzLikeText', () => {
  it.each([
    'P<UTOERIKSSON<<ANNA',
    '<<<<<<<',
    'L898902C3 6UTO7408122',
    'PAOELAPAZ<<MICHELLE<<<<<*',
    'SEE PAGE 27',
  ])('accepts %j', (text) => {
    expect(isMrzLikeText(text)).toBe(true);
  });

  it.each(['Visit >', 'Capturing a Clear Photo', 'bally,..', 'y', '', '   '])(
    'rejects %j',
    (text) => {
      expect(isMrzLikeText(text)).toBe(false);
    }
  );
});
