import type { MrzRect, MrzTextLine } from '../specs/MrzTextRecognizer.nitro';
import { cleanOcrText, isMrzLikeText } from './ocrText';

/** A visual row of text, rebuilt from the fragments OCR split it into. */
export interface TextRow {
  /** Cleaned text of all fragments, joined left to right. */
  readonly text: string;
  /** Union of the fragments' bounding boxes. */
  readonly boundingBox: MrzRect;
}

/**
 * Two fragments are on the same row when they overlap vertically by at least
 * this share of the shorter fragment's height…
 */
const MIN_VERTICAL_OVERLAP = 0.5;
/**
 * …and sit side by side, overlapping horizontally by at most this share of the
 * narrower one. Without this, the two MRZ lines of a slightly tilted passport
 * (whose boxes grow taller with the tilt) would be merged into one row.
 */
const MAX_HORIZONTAL_OVERLAP = 0.25;

/**
 * Groups OCR lines into rows. OCR often splits one MRZ line into pieces (for
 * example the name and a long run of `<<<<`); this joins them back together.
 * Fragments that are clearly ordinary text (mostly lower case or punctuation)
 * are left out, so they cannot corrupt an MRZ line on the same row.
 * Rows are returned top to bottom.
 */
export function groupIntoRows(lines: readonly MrzTextLine[]): TextRow[] {
  const fragments = lines
    .filter(
      (line) =>
        line.boundingBox.width > 0 &&
        line.boundingBox.height > 0 &&
        isMrzLikeText(line.text)
    )
    .sort((a, b) => centerY(a.boundingBox) - centerY(b.boundingBox));

  const rows: Array<{ fragments: MrzTextLine[]; box: MrzRect }> = [];
  for (const fragment of fragments) {
    const box = fragment.boundingBox;
    let best: (typeof rows)[number] | undefined;
    for (const row of rows) {
      if (
        fitsRow(row, box) &&
        (best === undefined ||
          Math.abs(centerY(row.box) - centerY(box)) <
            Math.abs(centerY(best.box) - centerY(box)))
      ) {
        best = row;
      }
    }
    if (best === undefined) {
      rows.push({ fragments: [fragment], box });
    } else {
      best.fragments.push(fragment);
      best.box = union(best.box, box);
    }
  }

  return rows
    .sort((a, b) => centerY(a.box) - centerY(b.box))
    .map(({ fragments: rowFragments, box }) => ({
      text: [...rowFragments]
        .sort((a, b) => a.boundingBox.x - b.boundingBox.x)
        .map((fragment) => cleanOcrText(fragment.text))
        .join(''),
      boundingBox: box,
    }))
    .filter((row) => row.text.length > 0);
}

function centerY(box: MrzRect): number {
  return box.y + box.height / 2;
}

/** Level with the row, and beside (not above or below) each of its fragments. */
function fitsRow(
  row: { readonly fragments: readonly MrzTextLine[]; readonly box: MrzRect },
  box: MrzRect
): boolean {
  const verticalOverlap =
    Math.min(row.box.y + row.box.height, box.y + box.height) -
    Math.max(row.box.y, box.y);
  if (
    verticalOverlap <
    MIN_VERTICAL_OVERLAP * Math.min(row.box.height, box.height)
  ) {
    return false;
  }
  return row.fragments.every(({ boundingBox: other }) => {
    const horizontalOverlap =
      Math.min(other.x + other.width, box.x + box.width) -
      Math.max(other.x, box.x);
    return (
      horizontalOverlap <=
      MAX_HORIZONTAL_OVERLAP * Math.min(other.width, box.width)
    );
  });
}

function union(a: MrzRect, b: MrzRect): MrzRect {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}
