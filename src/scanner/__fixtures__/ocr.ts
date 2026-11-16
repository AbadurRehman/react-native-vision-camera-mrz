import { buildTd3 } from '../../mrz/__fixtures__/td3';
import type { MrzTextLine } from '../../specs/MrzTextRecognizer.nitro';

/** One OCR line at a vertical position, in normalized frame coordinates. */
export function ocrLine(
  text: string,
  y: number,
  x = 0.05,
  width = 0.9,
  height = 0.03
): MrzTextLine {
  return { text, boundingBox: { x, y, width, height } };
}

/** Vertical positions of the two MRZ lines in the frame. */
const LINE1_Y = 0.7;
const LINE2_Y = 0.75;

/** The ICAO specimen MRZ as clean OCR output. */
export const CLEAN_OCR: MrzTextLine[] = [
  ocrLine('P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', LINE1_Y),
  ocrLine('L898902C36UTO7408122F1204159ZE184226B<<<<<10', LINE2_Y),
];

/*
 * The specimen with the mistakes seen when recording a phone screen with the
 * example app: the `<` after `P` dropped, line 1 split into fragments, filler
 * runs shortened, spaces and stray characters inserted, ordinary text around
 * the MRZ, and the first character of line 2 hidden.
 */

/** The `<` after `P` dropped and the filler run returned as its own fragment. */
export const MESSY_OCR: MrzTextLine[] = [
  ocrLine('SEE PAGE 27', 0.62, 0.3, 0.3),
  ocrLine('PUTOERIKSSON <<ANNA<MARIA<<<<<<', LINE1_Y, 0.05, 0.6),
  ocrLine('<<<<<<<', LINE1_Y + 0.001, 0.7, 0.25),
  ocrLine('L898902C36UTO7408122F1204159 ZE184226B<<10', LINE2_Y),
  ocrLine('Capturing a Clear Photo of Your Passport', 0.82, 0.05, 0.7),
];

/** A stray `*`, a leading `:` and split words. */
export const NOISY_OCR: MrzTextLine[] = [
  ocrLine('P<UTOERIKSSON <<AN NA<MARIA<<<<<*', LINE1_Y),
  ocrLine(':L898902C36UTO7408122F1204159ZE184226B<<<<<10', LINE2_Y),
];

/** Line 1 in three fragments, one filler read as `K`, `Visit >` beside line 2. */
export const FRAGMENTED_OCR: MrzTextLine[] = [
  ocrLine('<<ANNA<MARIA<<K<<<<', LINE1_Y + 0.002, 0.4, 0.3),
  ocrLine('P<UTOERIKSSON', LINE1_Y, 0.05, 0.33),
  ocrLine('<<<<<<<', LINE1_Y - 0.001, 0.72, 0.22),
  ocrLine(
    'L898902C3 6UTO7408122 F1204159ZE184226B <<<<<1 0',
    LINE2_Y,
    0.05,
    0.8
  ),
  ocrLine('Visit >', LINE2_Y, 0.87, 0.1),
];

/** The filler after the given names read as `K`, so the name looks longer. */
export const LETTER_AFTER_NAME_OCR: MrzTextLine[] = [
  ocrLine('P<UTOERIKSSON<<ANNA<MARIAK<<<<<<<<<<<<<<<<<<', LINE1_Y),
  ocrLine('L898902C36UTO7408122F1204159ZE184226B<<<<<10', LINE2_Y),
];

/** The first character of line 2 hidden (by a finger or an on-screen button). */
export const HIDDEN_START_OCR: MrzTextLine[] = [
  ocrLine('P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', LINE1_Y),
  ocrLine('898902C36UTO7408122F1204159ZE184226B<<<<<10', LINE2_Y, 0.07, 0.88),
];

/** A digit read twice near the end of line 2. */
export const REPEATED_DIGIT_OCR: MrzTextLine[] = [
  ocrLine('P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', LINE1_Y),
  ocrLine('L898902C36UTO7408122F1204159ZE184226B<<<<<110', LINE2_Y),
];

/** Line 1 cut off on the left, as when the passport does not fill the frame. */
export const CUT_OFF_OCR: MrzTextLine[] = [
  ocrLine('IKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', LINE1_Y, 0.2, 0.75),
  ocrLine('L898902C36UTO7408122F1204159ZE184226B<<<<<10', LINE2_Y),
];

/** A readable MRZ whose document number was misread (check digit fails). */
export const MISREAD_OCR: MrzTextLine[] = [
  ocrLine('P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', LINE1_Y),
  ocrLine('L898982C36UTO7408122F1204159ZE184226B<<<<<10', LINE2_Y),
];

/** A 7-character document number, printed `C239248<<` + check digit. */
export const SHORT_DOCUMENT_NUMBER = buildTd3({ documentNumber: 'C239248' });

/** The fillers after the short document number dropped by OCR. */
export const SHORT_DOCUMENT_NUMBER_OCR: MrzTextLine[] = [
  ocrLine(SHORT_DOCUMENT_NUMBER[0], LINE1_Y),
  ocrLine(SHORT_DOCUMENT_NUMBER[1].replace('C239248<<', 'C239248'), LINE2_Y),
];

/**
 * Like a mock passport seen in the wild: line 1 is printed without an issuing
 * state (`P<OLSSON…` instead of `P<UTOOLSSON…`). Line 2 is valid, so only the
 * unknown state code (`OLS`) shows that the MRZ is wrong.
 */
export const MISSING_STATE_OCR: MrzTextLine[] = [
  ocrLine('P<OLSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<<<<<<', LINE1_Y),
  ocrLine('L898902C36UTO7408122F1204159ZE184226B<<<<<10', LINE2_Y),
];
