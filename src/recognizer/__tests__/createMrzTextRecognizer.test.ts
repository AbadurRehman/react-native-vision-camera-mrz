import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockCreateTextRecognizer = jest.fn((_options: unknown) => ({
  name: 'MrzTextRecognizer',
}));
const mockCreateHybridObject = jest.fn((_name: string) => ({
  createTextRecognizer: mockCreateTextRecognizer,
}));

jest.mock('react-native-nitro-modules', () => ({
  NitroModules: { createHybridObject: mockCreateHybridObject },
}));

type Module = typeof import('../createMrzTextRecognizer.native');

/** Loads a fresh copy of the module, so the lazily created factory is reset. */
function loadModule(): Module {
  let loaded: Module | undefined;
  jest.isolateModules(() => {
    loaded = require('../createMrzTextRecognizer.native') as Module;
  });
  return loaded as Module;
}

describe('createMrzTextRecognizer', () => {
  beforeEach(() => {
    mockCreateTextRecognizer.mockClear();
    mockCreateHybridObject.mockClear();
  });

  it('does not touch native code when imported', () => {
    loadModule();
    expect(mockCreateHybridObject).not.toHaveBeenCalled();
  });

  it('creates the native factory once and reuses it', () => {
    const { createMrzTextRecognizer } = loadModule();
    createMrzTextRecognizer();
    createMrzTextRecognizer();
    expect(mockCreateHybridObject).toHaveBeenCalledTimes(1);
    expect(mockCreateHybridObject).toHaveBeenCalledWith(
      'MrzTextRecognizerFactory'
    );
    expect(mockCreateTextRecognizer).toHaveBeenCalledTimes(2);
  });

  it('passes default options to native code', () => {
    loadModule().createMrzTextRecognizer();
    expect(mockCreateTextRecognizer).toHaveBeenCalledWith({});
  });

  it('passes a copy of the region of interest', () => {
    const regionOfInterest = { x: 0, y: 0.55, width: 1, height: 0.3 };
    loadModule().createMrzTextRecognizer({ regionOfInterest });
    expect(mockCreateTextRecognizer).toHaveBeenCalledWith({ regionOfInterest });
    expect(mockCreateTextRecognizer.mock.calls[0]?.[0]).not.toBe(
      regionOfInterest
    );
  });

  it('validates options before calling native code', () => {
    const { createMrzTextRecognizer } = loadModule();
    expect(() =>
      createMrzTextRecognizer({
        regionOfInterest: { x: 0, y: 0.9, width: 1, height: 0.3 },
      })
    ).toThrow(RangeError);
    expect(mockCreateHybridObject).not.toHaveBeenCalled();
    expect(mockCreateTextRecognizer).not.toHaveBeenCalled();
  });
});

describe('createMrzTextRecognizer on unsupported platforms', () => {
  it('throws a clear error', () => {
    let fallback: typeof import('../createMrzTextRecognizer') | undefined;
    jest.isolateModules(() => {
      // Load the platform-independent file explicitly (not the .native one).
      fallback = require('../createMrzTextRecognizer.ts');
    });
    expect(() => fallback?.createMrzTextRecognizer()).toThrow(
      /only available on iOS and Android/
    );
  });
});
