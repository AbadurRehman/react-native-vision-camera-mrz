import { describe, expect, it } from '@jest/globals';
import {
  computePassportGuide,
  frameRectToViewRect,
  isUsableSize,
  PASSPORT_ASPECT_RATIO,
  viewRectToFrameRect,
} from '../geometry';

/** A portrait phone screen and a 16:9 frame seen upright. */
const VIEW = { width: 400, height: 800 };
const FRAME = { width: 720, height: 1280 };

describe('viewRectToFrameRect', () => {
  it('accounts for the preview being cropped to fill the view', () => {
    // Scale 0.625 → the frame is shown 450 × 800, 25 px cropped on each side.
    const rect = viewRectToFrameRect(
      { x: 0, y: 400, width: 400, height: 200 },
      VIEW,
      FRAME
    );
    expect(rect.x).toBeCloseTo(25 / 450);
    expect(rect.width).toBeCloseTo(400 / 450);
    expect(rect.y).toBeCloseTo(0.5);
    expect(rect.height).toBeCloseTo(0.25);
  });

  it('clamps to the frame', () => {
    const rect = viewRectToFrameRect(
      { x: -100, y: -100, width: 1000, height: 2000 },
      VIEW,
      FRAME
    );
    expect(rect).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it('is undone by frameRectToViewRect', () => {
    const original = { x: 20, y: 300, width: 360, height: 120 };
    const roundTrip = frameRectToViewRect(
      viewRectToFrameRect(original, VIEW, FRAME),
      VIEW,
      FRAME
    );
    expect(roundTrip.x).toBeCloseTo(original.x);
    expect(roundTrip.y).toBeCloseTo(original.y);
    expect(roundTrip.width).toBeCloseTo(original.width);
    expect(roundTrip.height).toBeCloseTo(original.height);
  });
});

describe('computePassportGuide', () => {
  it.each([[{ width: 400, height: 800 }], [{ width: 800, height: 400 }]])(
    'fits a passport-shaped outline inside %j',
    (view) => {
      const { page, mrzZone, scanArea } = computePassportGuide(view);
      expect(page.width / page.height).toBeCloseTo(PASSPORT_ASPECT_RATIO);
      expect(page.x).toBeGreaterThanOrEqual(0);
      expect(page.y).toBeGreaterThanOrEqual(0);
      expect(page.x + page.width).toBeLessThanOrEqual(view.width);
      expect(page.y + page.height).toBeLessThanOrEqual(view.height);
      // The MRZ zone is the bottom of the page.
      expect(mrzZone.y + mrzZone.height).toBeCloseTo(page.y + page.height);
      // The scan area covers the MRZ zone and stays inside the view.
      expect(scanArea.y).toBeLessThan(mrzZone.y);
      expect(scanArea.y + scanArea.height).toBeGreaterThan(
        mrzZone.y + mrzZone.height
      );
      expect(scanArea.y).toBeGreaterThanOrEqual(0);
      expect(scanArea.y + scanArea.height).toBeLessThanOrEqual(view.height);
      // It spans the whole width, so long MRZ lines are never cut off.
      expect(scanArea.x).toBe(0);
      expect(scanArea.width).toBe(view.width);
    }
  );
});

describe('isUsableSize', () => {
  it('accepts positive finite sizes only', () => {
    expect(isUsableSize({ width: 1, height: 1 })).toBe(true);
    expect(isUsableSize(undefined)).toBe(false);
    expect(isUsableSize({ width: 0, height: 1 })).toBe(false);
    expect(isUsableSize({ width: Number.NaN, height: 1 })).toBe(false);
  });
});
