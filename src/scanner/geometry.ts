/**
 * Conversions between on-screen positions (view pixels) and normalized frame
 * coordinates, for a camera preview that fills its view (`resizeMode: 'cover'`,
 * VisionCamera's default).
 */
import type { MrzRect } from '../specs/MrzTextRecognizer.nitro';

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** A rectangle in view pixels. */
export interface ViewRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Width ÷ height of a passport data page (TD3: 125 × 88 mm). */
export const PASSPORT_ASPECT_RATIO = 125 / 88;
/** The MRZ sits in the bottom part of the page; this share includes a margin. */
const MRZ_ZONE_SHARE = 0.3;
/** Largest share of the view the passport outline may take. */
const MAX_GUIDE_WIDTH_SHARE = 0.9;
const MAX_GUIDE_HEIGHT_SHARE = 0.6;
/**
 * Extra room around the MRZ zone, in zone heights, so the MRZ is still found
 * when the passport is held loosely. People tend to hold it closer than the
 * outline, which moves the MRZ down, so there is more room below.
 */
const SCAN_MARGIN_ABOVE = 0.5;
const SCAN_MARGIN_BELOW = 1;

export interface PassportGuide {
  /** Outline of the passport data page. */
  readonly page: ViewRect;
  /** The part of the page where the MRZ is printed. */
  readonly mrzZone: ViewRect;
  /**
   * The area to read text from: the MRZ zone plus a margin, across the whole
   * width of the view so the ends of long MRZ lines are never cut off.
   */
  readonly scanArea: ViewRect;
}

/** Lays out a passport-shaped guide centred in the view. */
export function computePassportGuide(view: Size): PassportGuide {
  const width = Math.min(
    view.width * MAX_GUIDE_WIDTH_SHARE,
    view.height * MAX_GUIDE_HEIGHT_SHARE * PASSPORT_ASPECT_RATIO
  );
  const height = width / PASSPORT_ASPECT_RATIO;
  const page = {
    x: (view.width - width) / 2,
    y: (view.height - height) / 2,
    width,
    height,
  };
  const zoneHeight = height * MRZ_ZONE_SHARE;
  const mrzZone = {
    x: page.x,
    y: page.y + height - zoneHeight,
    width,
    height: zoneHeight,
  };
  const scanArea = clampToView(
    {
      x: 0,
      y: mrzZone.y - zoneHeight * SCAN_MARGIN_ABOVE,
      width: view.width,
      height: zoneHeight * (1 + SCAN_MARGIN_ABOVE + SCAN_MARGIN_BELOW),
    },
    view
  );
  return { page, mrzZone, scanArea };
}

/**
 * Maps a rectangle in view pixels to normalized frame coordinates.
 * `frame` is the upright frame size (as the user sees it).
 */
export function viewRectToFrameRect(
  rect: ViewRect,
  view: Size,
  frame: Size
): MrzRect {
  const { scale, offsetX, offsetY } = coverTransform(view, frame);
  const displayedWidth = frame.width * scale;
  const displayedHeight = frame.height * scale;
  const left = clamp01((rect.x + offsetX) / displayedWidth);
  const top = clamp01((rect.y + offsetY) / displayedHeight);
  const right = clamp01((rect.x + rect.width + offsetX) / displayedWidth);
  const bottom = clamp01((rect.y + rect.height + offsetY) / displayedHeight);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Maps a normalized frame rectangle to view pixels (the inverse of the above). */
export function frameRectToViewRect(
  rect: MrzRect,
  view: Size,
  frame: Size
): ViewRect {
  const { scale, offsetX, offsetY } = coverTransform(view, frame);
  return {
    x: rect.x * frame.width * scale - offsetX,
    y: rect.y * frame.height * scale - offsetY,
    width: rect.width * frame.width * scale,
    height: rect.height * frame.height * scale,
  };
}

/** `true` when both sizes are positive and finite. */
export function isUsableSize(size: Size | undefined): size is Size {
  return (
    size !== undefined &&
    Number.isFinite(size.width) &&
    Number.isFinite(size.height) &&
    size.width > 0 &&
    size.height > 0
  );
}

/** Scale and crop offsets of a frame scaled to fill the view. */
function coverTransform(view: Size, frame: Size) {
  const scale = Math.max(view.width / frame.width, view.height / frame.height);
  return {
    scale,
    offsetX: (frame.width * scale - view.width) / 2,
    offsetY: (frame.height * scale - view.height) / 2,
  };
}

function clampToView(rect: ViewRect, view: Size): ViewRect {
  const left = Math.max(0, rect.x);
  const top = Math.max(0, rect.y);
  const right = Math.min(view.width, rect.x + rect.width);
  const bottom = Math.min(view.height, rect.y + rect.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
