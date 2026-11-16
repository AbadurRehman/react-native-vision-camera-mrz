import { describe, expect, it } from '@jest/globals';
import { SPECIMENS, type Specimen } from '../../mrz/__fixtures__/specimens';
import type { MrzTextLine } from '../../specs/MrzTextRecognizer.nitro';
import { ocrLine } from '../__fixtures__/ocr';
import { MrzScanSession } from '../scanSession';

const LINE1_Y = 0.7;
const LINE2_Y = 0.75;

/** OCR often drops the `<` after the document code `P`. */
function dropFillerAfterCode(line: string): string {
  return line.startsWith('P<') ? `P${line.slice(2)}` : line;
}

/** OCR often reads long filler runs a few characters short. */
function shortenFillerRuns(line: string): string {
  return line.replace(/<{5,}/g, (run) => run.slice(2));
}

/** OCR often drops the fillers that pad short values (`D<<`, `T1234567<`). */
function dropShortPadding(line: string): string {
  return line.replace(/(?<=[A-Z0-9])<{1,2}(?=[A-Z0-9])/g, '');
}

/** Splits a line into two fragments at its first filler run, with spaces. */
function splitIntoFragments(line: string, y: number): MrzTextLine[] {
  const split = line.indexOf('<<', 5);
  if (split === -1) {
    return [ocrLine(line, y)];
  }
  return [
    ocrLine(`${line.slice(0, split)} `, y, 0.05, 0.4),
    ocrLine(` ${line.slice(split)}`, y + 0.002, 0.47, 0.48),
  ];
}

function frames(specimen: Specimen): MrzTextLine[][] {
  const [line1, line2] = specimen.lines;
  return [
    [
      ocrLine(dropFillerAfterCode(line1), LINE1_Y),
      ocrLine(dropShortPadding(line2), LINE2_Y),
    ],
    [
      ...splitIntoFragments(shortenFillerRuns(line1), LINE1_Y),
      ocrLine(shortenFillerRuns(line2), LINE2_Y),
    ],
    [ocrLine(line1, LINE1_Y), ocrLine(line2, LINE2_Y)],
  ];
}

describe('scanning the specimen passports', () => {
  it.each(SPECIMENS.map((specimen) => [specimen.id, specimen] as const))(
    'confirms the %s specimen through typical OCR damage',
    (_id, specimen) => {
      const session = new MrzScanSession();
      const updates = frames(specimen).map((frame) => session.process(frame));

      expect(updates.map((update) => update.status)).toEqual([
        'reading',
        'reading',
        'done',
      ]);
      const result = updates[2]?.result;
      expect(result?.lines).toEqual(specimen.lines);
      expect(result?.fields.documentNumber).toBe(
        specimen.expected.documentNumber
      );
    }
  );
});
