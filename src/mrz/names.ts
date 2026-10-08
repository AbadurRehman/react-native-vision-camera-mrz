import { FILLER } from './checkDigit';
import { stripTrailingFillers } from './fieldValues';

const NAME_SEPARATOR = FILLER + FILLER;

export interface MrzName {
  /** Primary identifier (surname). */
  readonly surname: string;
  /** Secondary identifier (given names); empty when absent. */
  readonly givenNames: string;
}

/**
 * Splits an MRZ name field such as `ERIKSSON<<ANNA<MARIA<<<<` into surname and
 * given names. `<<` separates the two; a single `<` separates components.
 */
export function parseMrzName(field: string): MrzName {
  const name = stripTrailingFillers(field);
  const separatorIndex = name.indexOf(NAME_SEPARATOR);
  if (separatorIndex === -1) {
    return { surname: toWords(name), givenNames: '' };
  }
  return {
    surname: toWords(name.slice(0, separatorIndex)),
    givenNames: toWords(name.slice(separatorIndex + NAME_SEPARATOR.length)),
  };
}

function toWords(value: string): string {
  return value
    .split(FILLER)
    .filter((word) => word.length > 0)
    .join(' ');
}
