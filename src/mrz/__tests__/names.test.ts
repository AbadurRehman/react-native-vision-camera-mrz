import { describe, expect, it } from '@jest/globals';
import { parseMrzName } from '../names';

describe('parseMrzName', () => {
  it.each([
    ['ERIKSSON<<ANNA<MARIA<<<<<<<<', 'ERIKSSON', 'ANNA MARIA'],
    ['MUSTERMANN<<ERIKA', 'MUSTERMANN', 'ERIKA'],
    ['VAN<DER<BERG<<JAN<PIETER', 'VAN DER BERG', 'JAN PIETER'],
    ['SMITH<<<JOHN', 'SMITH', 'JOHN'],
    ['NEWTON<<<<<<<<', 'NEWTON', ''],
    ['<<JOHN', '', 'JOHN'],
    ['<<<<<<', '', ''],
    ['', '', ''],
  ])('splits %j into %j and %j', (field, surname, givenNames) => {
    expect(parseMrzName(field)).toEqual({ surname, givenNames });
  });

  it('keeps a name that fills the whole field (possibly truncated)', () => {
    expect(parseMrzName('ABCDEFGHIJKLMNOPQRST<<UVWXYZABCDEFGHIJK')).toEqual({
      surname: 'ABCDEFGHIJKLMNOPQRST',
      givenNames: 'UVWXYZABCDEFGHIJK',
    });
  });
});
