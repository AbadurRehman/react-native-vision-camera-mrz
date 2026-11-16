import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import type { MrzTextLine } from '../../specs/MrzTextRecognizer.nitro';
import { CLEAN_OCR } from '../__fixtures__/ocr';
import type { MrzScanUpdate } from '../scanSession';
import {
  nextScannerState,
  useMrzScanner,
  type UseMrzScannerOptions,
} from '../useMrzScanner';

interface FrameOutputOptions {
  targetResolution: { width: number; height: number };
  pixelFormat: string;
  onFrame: (frame: FakeFrame) => void;
  onFrameDropped: () => void;
}

interface FakeFrame {
  width: number;
  height: number;
  orientation: 'up' | 'down' | 'left' | 'right';
  dispose: jest.Mock;
}

let mockFrameOutputOptions: FrameOutputOptions | undefined;
const mockRecognizeText = jest.fn<(frame: unknown) => MrzTextLine[]>();

jest.mock('react-native-vision-camera', () => ({
  CommonResolutions: { FHD_16_9: { width: 1080, height: 1920 } },
  useFrameOutput: (options: FrameOutputOptions) => {
    mockFrameOutputOptions = options;
    return { kind: 'frame-output' };
  },
}));
jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (callback: (...args: unknown[]) => void, ...args: unknown[]) =>
    callback(...args),
}));
jest.mock('../../recognizer/useMrzTextRecognizer', () => ({
  useMrzTextRecognizer: () => ({ recognizeText: mockRecognizeText }),
}));

function createFrame(orientation: FakeFrame['orientation'] = 'right') {
  return { width: 1920, height: 1080, orientation, dispose: jest.fn() };
}

/** Sends one frame through the frame processor. */
async function sendFrame(frame: FakeFrame = createFrame()) {
  const options = mockFrameOutputOptions;
  if (options === undefined) {
    throw new Error('useFrameOutput was not called');
  }
  await act(() => options.onFrame(frame));
  return frame;
}

async function renderScanner(options: Partial<UseMrzScannerOptions> = {}) {
  const onResult = jest.fn();
  const onError = jest.fn();
  const hook = await renderHook(
    (props: Partial<UseMrzScannerOptions>) =>
      useMrzScanner({ onResult, onError, ...props }),
    { initialProps: options }
  );
  return { ...hook, onResult, onError };
}

describe('useMrzScanner', () => {
  beforeEach(() => {
    mockFrameOutputOptions = undefined;
    mockRecognizeText.mockReset();
    mockRecognizeText.mockReturnValue(CLEAN_OCR);
  });

  it('asks VisionCamera for Full HD YUV frames', async () => {
    const { result } = await renderScanner();
    expect(result.current.frameOutput).toEqual({ kind: 'frame-output' });
    expect(mockFrameOutputOptions?.targetResolution).toEqual({
      width: 1080,
      height: 1920,
    });
    expect(mockFrameOutputOptions?.pixelFormat).toBe('yuv');
  });

  it('skips frames that arrive while busy without warnings', async () => {
    const consoleWarn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});
    await renderScanner();
    mockFrameOutputOptions?.onFrameDropped();
    expect(consoleWarn).not.toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  it('reports the result once, after three frames agree, and then pauses', async () => {
    const { result, onResult } = await renderScanner();
    await sendFrame();
    await sendFrame();
    expect(result.current.state.status).toBe('reading');
    expect(onResult).not.toHaveBeenCalled();

    await sendFrame();
    expect(result.current.state.status).toBe('done');
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0]?.[0]).toMatchObject({
      valid: true,
      fields: { documentNumber: 'L898902C3' },
    });

    const frame = await sendFrame();
    expect(mockRecognizeText).toHaveBeenCalledTimes(3);
    expect(frame.dispose).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledTimes(1);
  });

  it('scans again after reset', async () => {
    const { result, onResult } = await renderScanner({
      requiredAgreement: 1,
      agreementWindow: 1,
    });
    await sendFrame();
    expect(onResult).toHaveBeenCalledTimes(1);

    await act(() => result.current.reset());
    expect(result.current.state.status).toBe('searching');
    await sendFrame();
    expect(onResult).toHaveBeenCalledTimes(2);
  });

  it('reports the upright frame size', async () => {
    const { result } = await renderScanner();
    await sendFrame(createFrame('right'));
    expect(result.current.state.frameSize).toEqual({
      width: 1080,
      height: 1920,
    });
    await sendFrame(createFrame('up'));
    expect(result.current.state.frameSize).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it('skips frames while inactive, but still releases them', async () => {
    await renderScanner({ isActive: false });
    const frame = await sendFrame();
    expect(mockRecognizeText).not.toHaveBeenCalled();
    expect(frame.dispose).toHaveBeenCalledTimes(1);
  });

  it('reports recognition errors and releases the frame', async () => {
    mockRecognizeText.mockImplementation(() => {
      throw new Error('The frame has no image data.');
    });
    const { onError } = await renderScanner();
    const frame = await sendFrame();
    expect(onError).toHaveBeenCalledWith(
      new Error('The frame has no image data.')
    );
    expect(frame.dispose).toHaveBeenCalledTimes(1);
  });

  it('reports errors that are not Error objects', async () => {
    mockRecognizeText.mockImplementation(() => {
      throw 'Recognition timed out';
    });
    const { onError } = await renderScanner();
    await sendFrame();
    expect(onError).toHaveBeenCalledWith(new Error('Recognition timed out'));
  });

  it('uses the latest onResult without restarting the scan', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = await renderHook(
      ({ onResult }: { onResult: () => void }) =>
        useMrzScanner({ onResult, requiredAgreement: 2 }),
      { initialProps: { onResult: first } }
    );
    await sendFrame();
    await rerender({ onResult: second });
    await sendFrame();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('starts a fresh scan when the agreement options change', async () => {
    const { result, rerender } = await renderScanner();
    await sendFrame();
    expect(result.current.state.status).toBe('reading');
    await rerender({ requiredAgreement: 2 });
    expect(result.current.state.status).toBe('searching');
  });
});

describe('nextScannerState', () => {
  const BOX = { x: 0, y: 0.7, width: 1, height: 0.05 };
  const READING: MrzScanUpdate = { status: 'reading', mrzBoxes: [BOX] };
  const initial = {
    status: 'searching' as const,
    mrzBoxes: [],
    frameSize: undefined,
  };

  it('applies a new status, boxes and frame size', () => {
    expect(nextScannerState(initial, READING, 720, 1280)).toEqual({
      status: 'reading',
      mrzBoxes: [BOX],
      frameSize: { width: 720, height: 1280 },
    });
  });

  it('returns the same state object when nothing changed', () => {
    const first = nextScannerState(initial, READING, 720, 1280);
    const second = nextScannerState(
      first,
      { status: 'reading', mrzBoxes: [{ ...BOX }] },
      720,
      1280
    );
    expect(second).toBe(first);
  });

  it('keeps the frame size object when only the boxes change', () => {
    const first = nextScannerState(initial, READING, 720, 1280);
    const second = nextScannerState(
      first,
      { status: 'reading', mrzBoxes: [{ ...BOX, y: 0.71 }] },
      720,
      1280
    );
    expect(second).not.toBe(first);
    expect(second.frameSize).toBe(first.frameSize);
  });

  it('updates the frame size when the camera changes resolution', () => {
    const first = nextScannerState(initial, READING, 720, 1280);
    expect(nextScannerState(first, READING, 1080, 1920).frameSize).toEqual({
      width: 1080,
      height: 1920,
    });
  });
});
