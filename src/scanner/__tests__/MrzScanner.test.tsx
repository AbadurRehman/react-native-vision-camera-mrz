import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createRef } from 'react';
import { Text } from 'react-native';
import type { MrzTextLine } from '../../specs/MrzTextRecognizer.nitro';
import { CLEAN_OCR } from '../__fixtures__/ocr';
import { MrzScanner, type MrzScannerHandle } from '../MrzScanner';

interface CameraProps {
  isActive: boolean;
  torchMode: 'on' | 'off';
  outputs: unknown[];
}

let mockPermission = {
  hasPermission: true,
  canRequestPermission: false,
  requestPermission: jest.fn(),
};
let mockDevice: { hasTorch: boolean } | undefined = { hasTorch: true };
let mockCameraProps: CameraProps | undefined;
let mockOnFrame: ((frame: unknown) => void) | undefined;
let mockRegionOfInterest: unknown;
const mockRecognizeText = jest.fn<() => MrzTextLine[]>();

jest.mock('react-native-vision-camera', () => ({
  CommonResolutions: { FHD_16_9: { width: 1080, height: 1920 } },
  Camera: (props: CameraProps) => {
    mockCameraProps = props;
    return null;
  },
  useCameraDevice: () => mockDevice,
  useCameraPermission: () => mockPermission,
  useFrameOutput: (options: { onFrame: (frame: unknown) => void }) => {
    mockOnFrame = options.onFrame;
    return { kind: 'frame-output' };
  },
}));
jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (callback: (...args: unknown[]) => void, ...args: unknown[]) =>
    callback(...args),
}));
jest.mock('../../recognizer/useMrzTextRecognizer', () => ({
  useMrzTextRecognizer: (options: { regionOfInterest: unknown }) => {
    mockRegionOfInterest = options.regionOfInterest;
    return { recognizeText: mockRecognizeText };
  },
}));

/** A portrait phone screen. */
const LAYOUT = { width: 400, height: 800 };

async function sendFrame() {
  const frame = {
    width: 1920,
    height: 1080,
    orientation: 'right',
    dispose: jest.fn(),
  };
  await act(() => mockOnFrame?.(frame));
}

async function renderScanner(
  props: Partial<Parameters<typeof MrzScanner>[0]> = {}
) {
  const onResult = jest.fn();
  await render(<MrzScanner testID="scanner" onResult={onResult} {...props} />);
  return { onResult };
}

describe('MrzScanner', () => {
  beforeEach(() => {
    mockPermission = {
      hasPermission: true,
      canRequestPermission: false,
      requestPermission: jest.fn(),
    };
    mockDevice = { hasTorch: true };
    mockCameraProps = undefined;
    mockOnFrame = undefined;
    mockRegionOfInterest = undefined;
    mockRecognizeText.mockReset();
    mockRecognizeText.mockReturnValue(CLEAN_OCR);
  });

  it('shows the camera with the frame output', async () => {
    await renderScanner();
    expect(mockCameraProps?.isActive).toBe(true);
    expect(mockCameraProps?.outputs).toEqual([{ kind: 'frame-output' }]);
  });

  it('shows the guide and a hint once laid out', async () => {
    await renderScanner();
    expect(
      screen.queryByText('Place the passport photo page inside the frame')
    ).toBeNull();
    await fireEvent.layout(screen.getByTestId('scanner'), LAYOUT);
    expect(
      screen.getByText('Place the passport photo page inside the frame')
    ).toBeTruthy();
  });

  it('reads only the area around the guide once the frame size is known', async () => {
    await renderScanner();
    await fireEvent.layout(screen.getByTestId('scanner'), LAYOUT);
    await sendFrame();
    expect(mockRegionOfInterest).toMatchObject({ width: expect.any(Number) });
    const region = mockRegionOfInterest as { y: number; height: number };
    // The guide's MRZ zone is in the lower middle of a portrait screen.
    expect(region.y).toBeGreaterThan(0.4);
    expect(region.y + region.height).toBeLessThan(0.9);
  });

  it('reports the result, shows it is done and stops the camera', async () => {
    const { onResult } = await renderScanner();
    await fireEvent.layout(screen.getByTestId('scanner'), LAYOUT);
    await sendFrame();
    expect(screen.getByText('Hold steady…')).toBeTruthy();
    await sendFrame();
    await sendFrame();
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Passport scanned')).toBeTruthy();
    expect(mockCameraProps?.isActive).toBe(false);
  });

  it('scans again after reset through its ref', async () => {
    const ref = createRef<MrzScannerHandle>();
    const { onResult } = await renderScanner({
      ref,
      requiredAgreement: 1,
      agreementWindow: 1,
    });
    await sendFrame();
    expect(onResult).toHaveBeenCalledTimes(1);
    await act(() => ref.current?.reset());
    expect(mockCameraProps?.isActive).toBe(true);
    await sendFrame();
    expect(onResult).toHaveBeenCalledTimes(2);
  });

  it('draws the detected MRZ lines when asked to', async () => {
    await renderScanner({ showMrzBoxes: true });
    await fireEvent.layout(screen.getByTestId('scanner'), LAYOUT);
    expect(screen.queryAllByTestId('scanner-mrz-line')).toHaveLength(0);
    await sendFrame();
    expect(screen.getAllByTestId('scanner-mrz-line')).toHaveLength(2);
  });

  it('does not draw MRZ lines by default', async () => {
    await renderScanner();
    await fireEvent.layout(screen.getByTestId('scanner'), LAYOUT);
    await sendFrame();
    expect(screen.queryAllByTestId('scanner-mrz-line')).toHaveLength(0);
  });

  it('toggles the torch', async () => {
    await renderScanner();
    expect(mockCameraProps?.torchMode).toBe('off');
    await fireEvent.press(screen.getByText('Light on'));
    expect(mockCameraProps?.torchMode).toBe('on');
    await fireEvent.press(screen.getByText('Light off'));
    expect(mockCameraProps?.torchMode).toBe('off');
  });

  it('hides the torch button on devices without a torch', async () => {
    mockDevice = { hasTorch: false };
    await renderScanner();
    expect(screen.queryByText('Light on')).toBeNull();
  });

  it('uses custom labels', async () => {
    await renderScanner({
      labels: { searching: 'Pasaporte aquí', turnOnLight: 'Linterna' },
    });
    await fireEvent.layout(screen.getByTestId('scanner'), LAYOUT);
    expect(screen.getByText('Pasaporte aquí')).toBeTruthy();
    expect(screen.getByText('Linterna')).toBeTruthy();
  });

  it('asks for camera permission and shows nothing while asking', async () => {
    mockPermission = {
      hasPermission: false,
      canRequestPermission: true,
      requestPermission: jest.fn(),
    };
    await renderScanner({ fallback: <Text>No camera</Text> });
    expect(mockPermission.requestPermission).toHaveBeenCalled();
    expect(screen.queryByText('No camera')).toBeNull();
    expect(mockCameraProps).toBeUndefined();
  });

  it('shows the fallback when permission was denied', async () => {
    mockPermission = {
      hasPermission: false,
      canRequestPermission: false,
      requestPermission: jest.fn(),
    };
    await renderScanner({ fallback: <Text>No camera</Text> });
    expect(screen.getByText('No camera')).toBeTruthy();
    expect(mockPermission.requestPermission).not.toHaveBeenCalled();
  });

  it('waits for the camera list without showing the fallback', async () => {
    mockDevice = undefined;
    await renderScanner({ fallback: <Text>No camera</Text> });
    expect(screen.queryByText('No camera')).toBeNull();
    expect(mockCameraProps).toBeUndefined();
  });
});
