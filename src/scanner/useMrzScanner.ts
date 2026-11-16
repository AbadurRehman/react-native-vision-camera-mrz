import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CommonResolutions,
  useFrameOutput,
  type CameraFrameOutput,
  type Frame,
} from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';
import { useMrzTextRecognizer } from '../recognizer/useMrzTextRecognizer';
import type { MrzRect, MrzTextLine } from '../specs/MrzTextRecognizer.nitro';
import type { Size } from './geometry';
import {
  MrzScanSession,
  type MrzScanResult,
  type MrzScanStatus,
  type MrzScanUpdate,
} from './scanSession';

/** A full-width band across the lower part of the upright frame. */
export const DEFAULT_SCAN_REGION: MrzRect = {
  x: 0,
  y: 0.5,
  width: 1,
  height: 0.4,
};

export interface UseMrzScannerOptions {
  /** Called once, when a valid MRZ has been confirmed. */
  onResult: (result: MrzScanResult) => void;
  /** Called when text recognition fails on a frame. */
  onError?: (error: Error) => void;
  /**
   * Area of the upright frame to read (normalized 0-1).
   * @default DEFAULT_SCAN_REGION
   */
  regionOfInterest?: MrzRect;
  /**
   * Set to `false` to pause scanning without unmounting the camera.
   * @default true
   */
  isActive?: boolean;
  /**
   * How many recent frames must read the same valid MRZ.
   * @default 3
   */
  requiredAgreement?: number;
  /**
   * How many recent frames to consider.
   * @default 10
   */
  agreementWindow?: number;
}

export interface MrzScannerState {
  readonly status: MrzScanStatus;
  /** Boxes of the MRZ lines in the latest frame (normalized, upright frame). */
  readonly mrzBoxes: readonly MrzRect[];
  /** Upright frame size in pixels; known once the first frame arrives. */
  readonly frameSize: Size | undefined;
}

export interface UseMrzScannerResult {
  /** Pass to VisionCamera: `<Camera outputs={[frameOutput]} />`. */
  readonly frameOutput: CameraFrameOutput;
  readonly state: MrzScannerState;
  /** Clears a finished scan so the next document can be scanned. */
  readonly reset: () => void;
}

const INITIAL_STATE: MrzScannerState = {
  status: 'searching',
  mrzBoxes: [],
  frameSize: undefined,
};

/**
 * Scans a passport MRZ with VisionCamera: reads text on-device, finds and
 * repairs the MRZ, and calls `onResult` once several frames agree. Scanning
 * then pauses until `reset()` is called.
 *
 * @example
 * const { frameOutput } = useMrzScanner({
 *   onResult: (result) => console.log(result.fields.documentNumber),
 * });
 * return <Camera device="back" isActive outputs={[frameOutput]} />;
 */
export function useMrzScanner(
  options: UseMrzScannerOptions
): UseMrzScannerResult {
  const {
    regionOfInterest = DEFAULT_SCAN_REGION,
    isActive = true,
    requiredAgreement,
    agreementWindow,
  } = options;

  const recognizer = useMrzTextRecognizer({ regionOfInterest });
  const session = useMemo(
    () => new MrzScanSession({ requiredAgreement, agreementWindow }),
    [requiredAgreement, agreementWindow]
  );
  const [state, setState] = useState<MrzScannerState>(INITIAL_STATE);

  // Use the latest callbacks without re-creating the frame processor.
  const callbacks = useRef(options);
  useEffect(() => {
    callbacks.current = options;
  });

  // Changed agreement options start a fresh scan.
  useEffect(() => {
    setState(INITIAL_STATE);
  }, [session]);

  const handleFrame = useCallback(
    (lines: MrzTextLine[], frameWidth: number, frameHeight: number) => {
      const update = session.process(lines);
      setState((previous) =>
        nextScannerState(previous, update, frameWidth, frameHeight)
      );
      if (update.result !== undefined) {
        callbacks.current.onResult(update.result);
      }
    },
    [session]
  );

  const handleError = useCallback((message: string) => {
    callbacks.current.onError?.(new Error(message));
  }, []);

  const isScanning = isActive && state.status !== 'done';

  const processFrame = useCallback(
    (frame: Frame) => {
      'worklet';
      try {
        if (!isScanning) {
          return;
        }
        const lines = recognizer.recognizeText(frame);
        const isSideways =
          frame.orientation === 'left' || frame.orientation === 'right';
        scheduleOnRN(
          handleFrame,
          lines,
          isSideways ? frame.height : frame.width,
          isSideways ? frame.width : frame.height
        );
      } catch (error) {
        scheduleOnRN(
          handleError,
          error instanceof Error ? error.message : String(error)
        );
      } finally {
        frame.dispose();
      }
    },
    [isScanning, recognizer, handleFrame, handleError]
  );

  const frameOutput = useFrameOutput({
    // Full HD keeps MRZ characters large enough for OCR (about 20 pixels
    // wide); only the region of interest is processed, so it stays fast.
    targetResolution: CommonResolutions.FHD_16_9,
    // ML Kit and Apple Vision read YUV buffers directly.
    pixelFormat: 'yuv',
    onFrame: processFrame,
  });

  const reset = useCallback(() => {
    session.reset();
    setState(INITIAL_STATE);
  }, [session]);

  return { frameOutput, state, reset };
}

/**
 * Applies a frame's update, keeping unchanged parts (and the whole state when
 * nothing changed) identical so React can skip re-rendering.
 */
export function nextScannerState(
  previous: MrzScannerState,
  update: MrzScanUpdate,
  frameWidth: number,
  frameHeight: number
): MrzScannerState {
  const frameSize =
    previous.frameSize?.width === frameWidth &&
    previous.frameSize.height === frameHeight
      ? previous.frameSize
      : { width: frameWidth, height: frameHeight };
  const mrzBoxes = haveSameBoxes(previous.mrzBoxes, update.mrzBoxes)
    ? previous.mrzBoxes
    : update.mrzBoxes;
  if (
    previous.status === update.status &&
    previous.frameSize === frameSize &&
    previous.mrzBoxes === mrzBoxes
  ) {
    return previous;
  }
  return { status: update.status, mrzBoxes, frameSize };
}

function haveSameBoxes(a: readonly MrzRect[], b: readonly MrzRect[]): boolean {
  return (
    a.length === b.length &&
    a.every((box, index) => {
      const other = b[index];
      return (
        other !== undefined &&
        box.x === other.x &&
        box.y === other.y &&
        box.width === other.width &&
        box.height === other.height
      );
    })
  );
}
