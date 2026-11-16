import { describe, expect, it } from '@jest/globals';
import { ocrLine } from '../__fixtures__/ocr';
import { groupIntoRows } from '../rows';

describe('groupIntoRows', () => {
  it('joins fragments of one row left to right', () => {
    const rows = groupIntoRows([
      ocrLine('<<<<<<', 0.701, 0.7, 0.25),
      ocrLine('P<UTOERIKSSON <<ANNA', 0.7, 0.05, 0.6),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.text).toBe('P<UTOERIKSSON<<ANNA<<<<<<');
    expect(rows[0]?.boundingBox.x).toBeCloseTo(0.05);
    expect(rows[0]?.boundingBox.width).toBeCloseTo(0.9);
  });

  it('joins a fragment that arrives after the fragments on both sides of it', () => {
    const rows = groupIntoRows([
      ocrLine('AAA', 0.7, 0.05, 0.3),
      ocrLine('CCC', 0.7, 0.65, 0.3),
      ocrLine('BBB', 0.705, 0.35, 0.3),
    ]);
    expect(rows.map((row) => row.text)).toEqual(['AAABBBCCC']);
  });

  it('keeps separate rows apart, top to bottom', () => {
    const rows = groupIntoRows([
      ocrLine('SECOND', 0.75),
      ocrLine('FIRST', 0.7),
    ]);
    expect(rows.map((row) => row.text)).toEqual(['FIRST', 'SECOND']);
  });

  it('does not merge rows that only touch', () => {
    // 0.70-0.73 and 0.725-0.755 overlap by 0.005, less than half a line.
    const rows = groupIntoRows([ocrLine('A', 0.7), ocrLine('B', 0.725)]);
    expect(rows).toHaveLength(2);
  });

  it('keeps the two lines of a tilted passport apart', () => {
    // Tilt makes each line's box taller, so the boxes overlap by half; but the
    // lines lie above each other, not side by side.
    const rows = groupIntoRows([
      ocrLine('LINE<ONE<<<<', 0.7, 0.05, 0.9, 0.06),
      ocrLine('LINE<TWO<<<<', 0.73, 0.05, 0.9, 0.06),
    ]);
    expect(rows.map((row) => row.text)).toEqual([
      'LINE<ONE<<<<',
      'LINE<TWO<<<<',
    ]);
  });

  it('leaves out ordinary text, even on the same row', () => {
    const rows = groupIntoRows([
      ocrLine('L898902C36UTO', 0.75, 0.05, 0.8),
      ocrLine('Visit >', 0.75, 0.87, 0.1),
      ocrLine('Capturing a Clear Photo', 0.82),
    ]);
    expect(rows.map((row) => row.text)).toEqual(['L898902C36UTO']);
  });

  it('drops empty rows and boxes without size', () => {
    const rows = groupIntoRows([
      ocrLine('...', 0.5),
      ocrLine('TEXT', 0.6, 0.05, 0.9, 0),
      ocrLine('TEXT', 0.65, 0.05, 0, 0.03),
      ocrLine('KEEP', 0.7),
    ]);
    expect(rows.map((row) => row.text)).toEqual(['KEEP']);
  });

  it('does not modify its input', () => {
    const input = [ocrLine('B', 0.8), ocrLine('A', 0.7)];
    groupIntoRows(input);
    expect(input.map((line) => line.text)).toEqual(['B', 'A']);
  });
});
