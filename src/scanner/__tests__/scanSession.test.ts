import { describe, expect, it } from '@jest/globals';
import { ICAO_SPECIMEN } from '../../mrz/__fixtures__/td3';
import {
  CLEAN_OCR,
  CUT_OFF_OCR,
  FRAGMENTED_OCR,
  HIDDEN_START_OCR,
  LETTER_AFTER_NAME_OCR,
  MESSY_OCR,
  MISREAD_OCR,
  MISSING_STATE_OCR,
  NOISY_OCR,
  REPEATED_DIGIT_OCR,
} from '../__fixtures__/ocr';
import {
  FrameAgreement,
  validateAgreementOptions,
  voteOnCharacters,
  type MrzLines,
} from '../agreement';
import { MrzScanSession } from '../scanSession';

const [LINE1, LINE2] = ICAO_SPECIMEN;
const reading = (line1: string, line2: string = LINE2): MrzLines => [
  line1,
  line2,
];

describe('voteOnCharacters', () => {
  it('takes the majority at each position', () => {
    expect(voteOnCharacters(['ABCD', 'AXCD', 'ABCY'])).toBe('ABCD');
  });

  it('needs a strict majority at every position', () => {
    expect(voteOnCharacters(['AB', 'AC'])).toBeNull();
    expect(voteOnCharacters(['AB', 'AC', 'AD'])).toBeNull();
    expect(voteOnCharacters(['AB', 'AB', 'AC', 'AD'])).toBeNull();
    expect(voteOnCharacters(['AB', 'AB', 'AB', 'AC'])).toBe('AB');
  });

  it('outvotes a reading that is shifted by a dropped character', () => {
    expect(
      voteOnCharacters(['ERIKSSON<<ANNA', 'ERIKSSON<ANNA<', 'ERIKSSON<<ANNA'])
    ).toBe('ERIKSSON<<ANNA');
  });

  it('rejects readings of different lengths and an empty list', () => {
    expect(voteOnCharacters(['ABC', 'AB'])).toBeNull();
    expect(voteOnCharacters([])).toBeNull();
  });
});

describe('FrameAgreement', () => {
  it('confirms a line 2 read the required number of times', () => {
    const agreement = new FrameAgreement({
      requiredAgreement: 2,
      agreementWindow: 3,
    });
    expect(agreement.add(reading(LINE1))).toBeNull();
    expect(agreement.add(reading(LINE1, 'OTHER'))).toBeNull();
    expect(agreement.add(reading(LINE1))).toEqual([LINE1, LINE2]);
  });

  it('votes on line 1 among the agreeing frames', () => {
    const agreement = new FrameAgreement({
      requiredAgreement: 3,
      agreementWindow: 5,
    });
    const typo1 = LINE1.replace('ANNA<MARIA<', 'ANNA<MARIAK');
    const typo2 = LINE1.replace('ERIKSSON', 'ERIKSS0N');
    agreement.add(reading(typo1));
    agreement.add(reading(typo2));
    expect(agreement.add(reading(LINE1))).toEqual([LINE1, LINE2]);
  });

  it('waits while line 1 has no majority', () => {
    const agreement = new FrameAgreement({
      requiredAgreement: 2,
      agreementWindow: 5,
    });
    agreement.add(reading(LINE1.replace('ANNA', 'ANNE')));
    expect(agreement.add(reading(LINE1))).toBeNull();
    expect(agreement.add(reading(LINE1))).toEqual([LINE1, LINE2]);
  });

  it('needs three of the last ten frames by default', () => {
    const agreement = new FrameAgreement();
    agreement.add(reading(LINE1));
    for (let index = 0; index < 7; index++) {
      agreement.add(null);
    }
    expect(agreement.add(reading(LINE1))).toBeNull();
    // The first reading is the 10th most recent frame: still counted.
    expect(agreement.add(reading(LINE1))).toEqual([LINE1, LINE2]);
  });

  it('forgets readings that left the window', () => {
    const agreement = new FrameAgreement({
      requiredAgreement: 2,
      agreementWindow: 2,
    });
    agreement.add(reading(LINE1));
    agreement.add(null);
    expect(agreement.add(reading(LINE1))).toBeNull();
  });

  it('never confirms an empty reading', () => {
    const agreement = new FrameAgreement({
      requiredAgreement: 1,
      agreementWindow: 1,
    });
    expect(agreement.add(null)).toBeNull();
  });

  it('starts over after reset', () => {
    const agreement = new FrameAgreement({
      requiredAgreement: 2,
      agreementWindow: 5,
    });
    agreement.add(reading(LINE1));
    agreement.reset();
    expect(agreement.add(reading(LINE1))).toBeNull();
  });

  it.each([
    [{ requiredAgreement: 0, agreementWindow: 5 }],
    [{ requiredAgreement: 3, agreementWindow: 2 }],
    [{ requiredAgreement: 1.5, agreementWindow: 5 }],
    [{ requiredAgreement: Number.NaN, agreementWindow: 5 }],
  ])('rejects %j', (options) => {
    expect(() => validateAgreementOptions(options)).toThrow(RangeError);
  });
});

describe('MrzScanSession', () => {
  it('confirms the MRZ once three recent frames agree', () => {
    const session = new MrzScanSession();
    expect(session.process(MESSY_OCR).status).toBe('reading');
    expect(session.process(NOISY_OCR).status).toBe('reading');
    const update = session.process(CLEAN_OCR);
    expect(update.status).toBe('done');
    expect(update.result?.lines).toEqual(ICAO_SPECIMEN);
    expect(update.result?.fields.surname).toBe('ERIKSSON');
  });

  it('reads the specimen through a sequence of messy frames', () => {
    // The kinds of readings seen when recording a phone screen: most frames
    // have a flaw, and only some have matching check digits.
    const frames = [
      HIDDEN_START_OCR,
      LETTER_AFTER_NAME_OCR,
      [],
      REPEATED_DIGIT_OCR,
      MESSY_OCR,
      MISREAD_OCR,
      FRAGMENTED_OCR,
    ];
    const session = new MrzScanSession();
    const updates = frames.map((frame) => session.process(frame));
    const last = updates[updates.length - 1];
    expect(last?.status).toBe('done');
    // "MARIAK" from one frame is outvoted.
    expect(last?.result?.fields.givenNames).toBe('ANNA MARIA');
    expect(last?.result?.lines).toEqual(ICAO_SPECIMEN);
    expect(
      updates.slice(0, -1).every((update) => update.result === undefined)
    ).toBe(true);
  });

  it('never confirms an MRZ without a known issuing state', () => {
    const session = new MrzScanSession();
    const statuses = Array.from(
      { length: 6 },
      () => session.process(MISSING_STATE_OCR).status
    );
    expect(statuses.every((status) => status === 'reading')).toBe(true);
  });

  it('reports the result only once', () => {
    const session = new MrzScanSession({
      requiredAgreement: 1,
      agreementWindow: 1,
    });
    expect(session.process(CLEAN_OCR).result).toBeDefined();
    expect(session.process(CLEAN_OCR)).toEqual({
      status: 'done',
      mrzBoxes: [],
    });
  });

  it('scans again after reset', () => {
    const session = new MrzScanSession({
      requiredAgreement: 1,
      agreementWindow: 1,
    });
    session.process(CLEAN_OCR);
    session.reset();
    expect(session.process([]).status).toBe('searching');
    expect(session.process(CLEAN_OCR).result).toBeDefined();
  });

  it('reports searching when no MRZ is in view', () => {
    const session = new MrzScanSession();
    expect(session.process([])).toEqual({ status: 'searching', mrzBoxes: [] });
    expect(session.process(CUT_OFF_OCR).status).toBe('searching');
  });

  it('keeps reporting reading through a few frames without an MRZ', () => {
    const session = new MrzScanSession();
    session.process(MISREAD_OCR);
    const statuses = [1, 2, 3, 4].map(() => session.process([]).status);
    expect(statuses).toEqual(['reading', 'reading', 'reading', 'searching']);
  });

  it('does not count frames whose check digits fail', () => {
    const session = new MrzScanSession({
      requiredAgreement: 1,
      agreementWindow: 1,
    });
    const update = session.process(MISREAD_OCR);
    expect(update.status).toBe('reading');
    expect(update.result).toBeUndefined();
  });

  it('lets old readings age out', () => {
    const session = new MrzScanSession({
      requiredAgreement: 2,
      agreementWindow: 2,
    });
    session.process(CLEAN_OCR);
    session.process([]);
    expect(session.process(CLEAN_OCR).status).toBe('reading');
    expect(session.process(CLEAN_OCR).status).toBe('done');
  });

  it('returns the boxes of the MRZ rows', () => {
    const update = new MrzScanSession().process(MESSY_OCR);
    expect(update.mrzBoxes.map((box) => box.y)).toEqual([0.7, 0.75]);
  });

  it('rejects invalid agreement options', () => {
    expect(
      () => new MrzScanSession({ requiredAgreement: 11, agreementWindow: 10 })
    ).toThrow(RangeError);
  });
});
