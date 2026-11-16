import { describe, expect, it } from '@jest/globals';
import {
  buildTd3,
  GERMAN_SPECIMEN,
  ICAO_SPECIMEN,
} from '../../mrz/__fixtures__/td3';
import { hasValidTd3CheckDigits } from '../../mrz/formats/td3';
import {
  CLEAN_OCR,
  CUT_OFF_OCR,
  FRAGMENTED_OCR,
  HIDDEN_START_OCR,
  MESSY_OCR,
  MISREAD_OCR,
  MISSING_STATE_OCR,
  NOISY_OCR,
  REPEATED_DIGIT_OCR,
  SHORT_DOCUMENT_NUMBER,
  SHORT_DOCUMENT_NUMBER_OCR,
} from '../__fixtures__/ocr';
import { groupIntoRows } from '../rows';
import {
  findTd3Candidate,
  rebuildTd3Line1,
  rebuildTd3Line2,
} from '../td3Candidate';

const [LINE1, LINE2] = ICAO_SPECIMEN;
const [GERMAN_LINE1, GERMAN_LINE2] = GERMAN_SPECIMEN;

describe('rebuildTd3Line1', () => {
  it('keeps a correct line', () => {
    expect(rebuildTd3Line1(LINE1)).toBe(LINE1);
  });

  it('restores fillers lost at the end of the name field', () => {
    expect(rebuildTd3Line1('P<UTOERIKSSON<<ANNA<MARIA<<<')).toBe(LINE1);
  });

  it('puts back the filler after P', () => {
    expect(rebuildTd3Line1('PUTOERIKSSON<<ANNA<MARIA<<<<<')).toBe(LINE1);
    expect(rebuildTd3Line1('PD<<MUSTERMANN<<ERIKA<<<<<<')).toBe(GERMAN_LINE1);
  });

  it('puts back the filler after P before a state that only line 2 shows', () => {
    const unlisted = 'P<QQQERIKSSON<<ANNA<<<<<<<'.padEnd(44, '<');
    expect(rebuildTd3Line1('PQQQERIKSSON<<ANNA<<<<<<<', 'QQQ')).toBe(unlisted);
  });

  it("puts back the fillers after Germany's one-letter code", () => {
    expect(rebuildTd3Line1('P<DMUSTERMANN<<ERIKA<<<<<<', 'D<<')).toBe(
      GERMAN_LINE1
    );
    expect(rebuildTd3Line1('P<D<MUSTERMANN<<ERIKA<<<<<<', 'D<<')).toBe(
      GERMAN_LINE1
    );
  });

  it('leaves the state alone when line 2 shows a different short code', () => {
    expect(rebuildTd3Line1(LINE1, 'D<<')).toBe(LINE1);
  });

  it('never turns an unknown state into a different country', () => {
    // Without line 2 confirming D, "DEL" stays as read (and fails validation).
    const missingState = 'P<DELAPAZ<<MICHELLE<<<<<<<<<<<<<<<<<<<<<<<<<';
    expect(rebuildTd3Line1(missingState, 'USA')).toBe(missingState);
  });

  it('keeps a real document type letter', () => {
    const official = 'PO' + LINE1.slice(2);
    expect(rebuildTd3Line1(official)).toBe(official);
  });

  it('skips unrelated text in front of the line', () => {
    expect(rebuildTd3Line1('XX' + LINE1)).toBe(LINE1);
  });

  it('accepts issuing states missing from the code list', () => {
    const unlisted = 'P<QQQERIKSSON<<ANNA<<<<<<<';
    expect(rebuildTd3Line1(unlisted)).toBe(unlisted.padEnd(44, '<'));
  });

  it('trims extra fillers', () => {
    expect(rebuildTd3Line1(LINE1 + '<<<')).toBe(LINE1);
  });

  it.each([
    ['IKSSON<<ANNA<MARIA<<<<<<<<<<<', 'cut off on the left'],
    ['P<UTOERIKSSON<<AN', 'cut off on the right'],
    ['SEEPAGE27', 'not an MRZ'],
    ['', 'empty'],
  ])('rejects %j (%s)', (text, _reason) => {
    expect(rebuildTd3Line1(text)).toBeNull();
  });
});

describe('rebuildTd3Line2', () => {
  /** The repaired line, when its check digits match unambiguously. */
  const repaired = (text: string) => {
    const result = rebuildTd3Line2(text);
    return result?.hasValidCheckDigits ? result.line : null;
  };

  it('keeps a correct line', () => {
    expect(repaired(LINE2)).toBe(LINE2);
    expect(repaired(GERMAN_LINE2)).toBe(GERMAN_LINE2);
  });

  it('restores fillers lost in the optional data', () => {
    expect(repaired('L898902C36UTO7408122F1204159ZE184226B<<10')).toBe(LINE2);
  });

  it('removes extra fillers in the optional data', () => {
    expect(repaired('L898902C36UTO7408122F1204159ZE184226B<<<<<<<<10')).toBe(
      LINE2
    );
  });

  it('cuts off unrelated text before and after the line', () => {
    expect(repaired('2' + LINE2 + 'VISIT')).toBe(LINE2);
    expect(repaired(LINE2 + 'PASSPORTS')).toBe(LINE2);
  });

  it('restores fillers lost after a short document number', () => {
    const [, line2] = SHORT_DOCUMENT_NUMBER;
    expect(repaired(line2.replace('C239248<<', 'C239248'))).toBe(line2);
    expect(repaired(line2.replace('C239248<<', 'C239248<'))).toBe(line2);
  });

  it('removes extra fillers after a short document number', () => {
    const [, line2] = buildTd3({ documentNumber: 'X7654321' });
    expect(repaired(line2.replace('X7654321<', 'X7654321<<<'))).toBe(line2);
  });

  it('does not trust a frame when two different repairs both pass', () => {
    // By coincidence, "234567<<<" (text in front cut off) and "X1234567<"
    // (extra fillers removed) both match every check digit here.
    const [, line2] = buildTd3({ documentNumber: 'X1234567' });
    const result = rebuildTd3Line2(line2.replace('X1234567<', 'X1234567<<<'));
    expect(result).not.toBeNull();
    expect(result?.hasValidCheckDigits).toBe(false);
  });

  it("restores fillers lost after Germany's one-letter nationality", () => {
    expect(repaired('C01X00T478D6408125F2702283<<<<<<<<<<<<<<<4')).toBe(
      GERMAN_LINE2
    );
  });

  it('keeps blank optional data', () => {
    expect(repaired('C01X00T478D<<6408125F2702283<4')).toBe(GERMAN_LINE2);
  });

  it('tolerates letters misread in dates (the parser fixes them)', () => {
    const misread = 'L898902C36UTO74O8122F12O4159ZE184226B<<<<<10';
    expect(repaired(misread)).toBe(misread);
  });

  it('returns the most likely reading when no repair passes the check digits', () => {
    const misread = 'L898982C36UTO7408122F1204159ZE184226B<<<<<10';
    expect(rebuildTd3Line2(misread)).toEqual({
      line: misread,
      hasValidCheckDigits: false,
    });
    expect(hasValidTd3CheckDigits(misread)).toBe(false);
  });

  it.each([
    ['UTO7408122F1204159ZE184226B<<<<<10', 'no document number'],
    ['L898902C36UTO7408122F120415', 'cut off on the right'],
    ['CAPTURINGACLEARPHOTOOFYOURPASSPORT', 'not an MRZ'],
    ['', 'empty'],
  ])('rejects %j (%s)', (text, _reason) => {
    expect(rebuildTd3Line2(text)).toBeNull();
  });
});

describe('findTd3Candidate', () => {
  const find = (ocr: Parameters<typeof groupIntoRows>[0]) =>
    findTd3Candidate(groupIntoRows(ocr));

  it.each([
    ['clean OCR', CLEAN_OCR],
    ['a dropped filler after P, a split row and extra text', MESSY_OCR],
    ['stray punctuation', NOISY_OCR],
    ['three fragments, a misread filler and a button label', FRAGMENTED_OCR],
  ])('rebuilds the specimen from %s', (_description, ocr) => {
    const candidate = find(ocr);
    expect(candidate?.lines).toEqual([LINE1, LINE2]);
    expect(candidate?.hasValidCheckDigits).toBe(true);
  });

  it('rebuilds a short document number', () => {
    expect(find(SHORT_DOCUMENT_NUMBER_OCR)?.lines).toEqual(
      SHORT_DOCUMENT_NUMBER
    );
  });

  it.each([
    ['the first character of line 2 is hidden', HIDDEN_START_OCR],
    ['a digit was read twice', REPEATED_DIGIT_OCR],
    ['the document number was misread', MISREAD_OCR],
  ])('reports failing check digits when %s', (_description, ocr) => {
    expect(find(ocr)?.hasValidCheckDigits).toBe(false);
  });

  it('keeps a line 1 without issuing state as printed', () => {
    const candidate = find(MISSING_STATE_OCR);
    expect(candidate?.lines[0]).toBe(
      'P<OLSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<<<<<<'
    );
    expect(candidate?.hasValidCheckDigits).toBe(true);
  });

  it('returns the rows the lines came from', () => {
    expect(find(MESSY_OCR)?.rows.map((row) => row.boundingBox.y)).toEqual([
      0.7, 0.75,
    ]);
  });

  it('prefers a pair whose check digits match', () => {
    // A misread copy below the real MRZ (e.g. a second passport) is skipped.
    const rows = groupIntoRows([
      ...CLEAN_OCR,
      {
        ...MISREAD_OCR[0]!,
        boundingBox: { x: 0.05, y: 0.8, width: 0.9, height: 0.03 },
      },
      {
        ...MISREAD_OCR[1]!,
        boundingBox: { x: 0.05, y: 0.85, width: 0.9, height: 0.03 },
      },
    ]);
    expect(findTd3Candidate(rows)?.lines).toEqual([LINE1, LINE2]);
  });

  it('returns null when line 1 is cut off', () => {
    expect(find(CUT_OFF_OCR)).toBeNull();
  });

  it('returns null without two MRZ rows', () => {
    expect(find([CLEAN_OCR[1]!])).toBeNull();
    expect(find([])).toBeNull();
  });

  it('requires line 1 directly above line 2', () => {
    const swapped = groupIntoRows(CLEAN_OCR).reverse();
    expect(findTd3Candidate(swapped)).toBeNull();
  });
});
