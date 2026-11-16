import { parseMrz } from '../mrz/parseMrz';
import type { MrzParseResult, MrzParseSuccess } from '../mrz/types';
import type { MrzRect, MrzTextLine } from '../specs/MrzTextRecognizer.nitro';
import { DEFAULT_AGREEMENT, FrameAgreement } from './agreement';
import { groupIntoRows } from './rows';
import { findTd3Candidate } from './td3Candidate';

/**
 * - `searching`: no MRZ in view.
 * - `reading`: an MRZ is in view but has not been read reliably yet.
 * - `done`: a valid MRZ was confirmed; further frames are ignored.
 */
export type MrzScanStatus = 'searching' | 'reading' | 'done';

/** A confirmed scan: parsed, every check digit matches, every value valid. */
export type MrzScanResult = MrzParseSuccess & { readonly valid: true };

export interface MrzScanUpdate {
  readonly status: MrzScanStatus;
  /** Boxes of the MRZ lines found in this frame (normalized, upright frame). */
  readonly mrzBoxes: readonly MrzRect[];
  /** Present only on the frame that confirmed the scan. */
  readonly result?: MrzScanResult;
}

export interface MrzScanSessionOptions {
  /**
   * How many recent frames must read the same valid MRZ.
   * @default 3
   */
  readonly requiredAgreement?: number;
  /**
   * How many recent frames to consider.
   * @default 10
   */
  readonly agreementWindow?: number;
}

/**
 * Frames without an MRZ before the status falls back from `reading` to
 * `searching`. OCR misses the MRZ in the odd frame; this keeps the hint shown
 * to the user from flickering.
 */
const READING_GRACE_FRAMES = 3;

const DONE: MrzScanUpdate = { status: 'done', mrzBoxes: [] };

/**
 * Turns the text lines of successive frames into one confirmed MRZ:
 * find the MRZ rows, rebuild them, check them, and wait until several recent
 * frames agree. Platform-independent and synchronous, so it can also be fed
 * text from your own OCR.
 */
export class MrzScanSession {
  private readonly agreement: FrameAgreement;
  private isDone = false;
  private framesWithoutMrz = Number.POSITIVE_INFINITY;

  /** @throws {RangeError} If the agreement options are invalid. */
  constructor(options: MrzScanSessionOptions = {}) {
    this.agreement = new FrameAgreement({
      requiredAgreement:
        options.requiredAgreement ?? DEFAULT_AGREEMENT.requiredAgreement,
      agreementWindow:
        options.agreementWindow ?? DEFAULT_AGREEMENT.agreementWindow,
    });
  }

  /** Processes the text lines of one frame. */
  process(lines: readonly MrzTextLine[]): MrzScanUpdate {
    if (this.isDone) {
      return DONE;
    }

    const candidate = findTd3Candidate(groupIntoRows(lines));
    this.framesWithoutMrz = candidate === null ? this.framesWithoutMrz + 1 : 0;
    const mrzBoxes =
      candidate === null ? [] : candidate.rows.map((row) => row.boundingBox);

    const confirmed = this.agreement.add(
      candidate !== null && candidate.hasValidCheckDigits
        ? candidate.lines
        : null
    );
    if (confirmed !== null) {
      const parsed = parseMrz(confirmed);
      if (isScanResult(parsed)) {
        this.isDone = true;
        return { status: 'done', mrzBoxes, result: parsed };
      }
    }

    const status =
      this.framesWithoutMrz <= READING_GRACE_FRAMES ? 'reading' : 'searching';
    return { status, mrzBoxes };
  }

  /** Starts over, for scanning another document. */
  reset(): void {
    this.isDone = false;
    this.framesWithoutMrz = Number.POSITIVE_INFINITY;
    this.agreement.reset();
  }
}

function isScanResult(result: MrzParseResult): result is MrzScanResult {
  return result.ok && result.valid;
}
