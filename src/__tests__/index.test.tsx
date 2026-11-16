import { describe, expect, it, jest } from '@jest/globals';
import * as library from '../index';

jest.mock('react-native-nitro-modules', () => ({
  NitroModules: { createHybridObject: jest.fn() },
}));
jest.mock('react-native-vision-camera', () => ({
  Camera: () => null,
  useCameraDevice: jest.fn(),
  useCameraPermission: jest.fn(),
  useFrameOutput: jest.fn(),
}));
jest.mock('react-native-worklets', () => ({ scheduleOnRN: jest.fn() }));

describe('public API', () => {
  it('exports exactly the documented values', () => {
    expect(Object.keys(library).sort()).toEqual(
      [
        'DEFAULT_SCAN_REGION',
        'MrzScanSession',
        'MrzScanner',
        'computeCheckDigit',
        'createMrzTextRecognizer',
        'parseMrz',
        'useMrzScanner',
        'useMrzTextRecognizer',
      ].sort()
    );
  });
});
