/** OCR commonly renders two fillers (`<<`) as a single guillemet. */
const DOUBLE_FILLER_LOOKALIKE = /«/g;
/** Characters OCR returns in place of a single filler (`<`). */
const FILLER_LOOKALIKES = /[‹〈⟨＜]/g;
/** Anything that can never be part of an MRZ. */
const NON_MRZ_CHARACTERS = /[^A-Z0-9<]/g;
const WHITESPACE = /\s+/g;
/**
 * OCR sometimes reads one `<` in a long filler run as `K`. A lone `K` with two
 * fillers on each side is almost certainly such a misread, so it is put back.
 */
const K_IN_FILLER_RUN = /<<K(?=<<)/g;
/** Characters an MRZ fragment consists of, as OCR returns them. */
const MRZ_LIKE_CHARACTER = /[A-Z0-9<«‹〈⟨＜]/;
/**
 * Share of a fragment's characters that must look like MRZ characters. MRZ
 * text is upper case, digits and `<`; ordinary text ("Visit >", "Share") is
 * mostly lower case. A few stray characters (`*`, `.`) are tolerated.
 */
const MIN_MRZ_LIKE_SHARE = 0.7;

/**
 * Cleans one fragment of OCR output for MRZ matching: upper case, filler
 * look-alikes replaced, and everything else that cannot appear in an MRZ
 * (spaces, punctuation, stray `*` or `:`) removed. The MRZ layout and check
 * digits later restore anything this drops.
 */
export function cleanOcrText(text: string): string {
  return text
    .toUpperCase()
    .replace(DOUBLE_FILLER_LOOKALIKE, '<<')
    .replace(FILLER_LOOKALIKES, '<')
    .replace(NON_MRZ_CHARACTERS, '')
    .replace(K_IN_FILLER_RUN, '<<<');
}

/** `true` when a fragment of OCR output could be (part of) an MRZ line. */
export function isMrzLikeText(text: string): boolean {
  const characters = [...text.replace(WHITESPACE, '')];
  if (characters.length === 0) {
    return false;
  }
  const mrzLike = characters.filter((character) =>
    MRZ_LIKE_CHARACTER.test(character)
  ).length;
  return mrzLike >= MIN_MRZ_LIKE_SHARE * characters.length;
}
