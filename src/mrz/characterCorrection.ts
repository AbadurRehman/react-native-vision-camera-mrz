/**
 * Fixes common OCR confusions using the field's character class. A date can
 * only hold digits, so an `O` there must be a `0`; a name can only hold
 * letters, so a `0` there must be an `O`.
 *
 * Alphanumeric fields (document number, optional data) are never corrected,
 * because both readings are legal there. Check digits and multi-frame
 * agreement catch errors in those fields instead.
 */

export type CharacterClass = 'alphabetic' | 'numeric';

/** Letters OCR returns in place of digits. */
const LETTER_TO_DIGIT: ReadonlyMap<string, string> = new Map([
  ['O', '0'],
  ['Q', '0'],
  ['D', '0'],
  ['I', '1'],
  ['L', '1'],
  ['Z', '2'],
  ['S', '5'],
  ['G', '6'],
  ['B', '8'],
]);

/** Digits OCR returns in place of letters. */
const DIGIT_TO_LETTER: ReadonlyMap<string, string> = new Map([
  ['0', 'O'],
  ['1', 'I'],
  ['2', 'Z'],
  ['5', 'S'],
  ['6', 'G'],
  ['8', 'B'],
]);

/**
 * Replaces look-alike characters that are illegal for the character class.
 * Fillers (`<`) and characters without a known look-alike are left unchanged.
 */
export function correctCharacters(
  value: string,
  characterClass: CharacterClass
): string {
  const replacements =
    characterClass === 'numeric' ? LETTER_TO_DIGIT : DIGIT_TO_LETTER;
  let corrected = '';
  for (const character of value) {
    corrected += replacements.get(character) ?? character;
  }
  return corrected;
}
