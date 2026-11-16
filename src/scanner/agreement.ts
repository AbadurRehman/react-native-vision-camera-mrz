export interface AgreementOptions {
  /** How many recent frames must read the same valid MRZ. */
  readonly requiredAgreement: number;
  /** How many recent frames to consider. */
  readonly agreementWindow: number;
}

export const DEFAULT_AGREEMENT: AgreementOptions = {
  requiredAgreement: 3,
  agreementWindow: 10,
};

/** @throws {RangeError} If the numbers are not whole and 1 ≤ required ≤ window. */
export function validateAgreementOptions(options: AgreementOptions): void {
  const { requiredAgreement, agreementWindow } = options;
  if (
    !Number.isInteger(requiredAgreement) ||
    !Number.isInteger(agreementWindow) ||
    requiredAgreement < 1 ||
    agreementWindow < requiredAgreement
  ) {
    throw new RangeError(
      'requiredAgreement and agreementWindow must be whole numbers with 1 ≤ requiredAgreement ≤ agreementWindow.'
    );
  }
}

/** Both lines of a TD3 MRZ as read from one frame. */
export type MrzLines = readonly [string, string];

/**
 * Confirms an MRZ across frames.
 *
 * Line 2 carries every check digit, so a reading only counts when they all
 * match, and the same line 2 must be read in `requiredAgreement` of the last
 * `agreementWindow` frames. Line 1 has no check digits and OCR often gets a
 * character or two wrong, so it is voted on character by character among
 * those frames. Frames without a reading count too, so old readings age out.
 */
export class FrameAgreement {
  private readonly options: AgreementOptions;
  private readonly recent: Array<MrzLines | null> = [];

  /** @throws {RangeError} If the options are invalid. */
  constructor(options: AgreementOptions = DEFAULT_AGREEMENT) {
    validateAgreementOptions(options);
    this.options = options;
  }

  /**
   * Records one frame's reading (`null` when it had none, or its check digits
   * failed) and returns the confirmed lines once enough frames agree.
   */
  add(reading: MrzLines | null): MrzLines | null {
    this.recent.push(reading);
    if (this.recent.length > this.options.agreementWindow) {
      this.recent.shift();
    }
    if (reading === null) {
      return null;
    }
    const [, line2] = reading;
    const agreeing = this.recent.filter(
      (recent): recent is MrzLines => recent !== null && recent[1] === line2
    );
    if (agreeing.length < this.options.requiredAgreement) {
      return null;
    }
    const line1 = voteOnCharacters(agreeing.map(([first]) => first));
    return line1 === null ? null : [line1, line2];
  }

  reset(): void {
    this.recent.length = 0;
  }
}

/**
 * Combines readings of the same line character by character. Every position
 * needs a strict majority; otherwise there is no reliable answer yet and
 * `null` is returned. Readings must have the same length.
 */
export function voteOnCharacters(readings: readonly string[]): string | null {
  const first = readings[0];
  if (
    first === undefined ||
    readings.some((reading) => reading.length !== first.length)
  ) {
    return null;
  }
  let result = '';
  for (let index = 0; index < first.length; index++) {
    const counts = new Map<string, number>();
    let winner = '';
    let winnerCount = 0;
    for (const reading of readings) {
      const character = reading.charAt(index);
      const count = (counts.get(character) ?? 0) + 1;
      counts.set(character, count);
      if (count > winnerCount) {
        winner = character;
        winnerCount = count;
      }
    }
    if (winnerCount * 2 <= readings.length) {
      return null;
    }
    result += winner;
  }
  return result;
}
