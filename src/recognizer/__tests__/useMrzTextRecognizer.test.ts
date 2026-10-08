import { beforeEach, describe, expect, it, jest } from '@jest/globals';

/** Dependencies passed to the last `useMemo` call. */
let mockLastDependencies: readonly unknown[] = [];

// Run the memo factory directly and record its dependencies; this is all the
// hook does with React.
jest.mock('react', () => ({
  useMemo: (factory: () => unknown, dependencies: readonly unknown[]) => {
    mockLastDependencies = dependencies;
    return factory();
  },
}));

const mockCreateMrzTextRecognizer = jest.fn((_options: unknown) => ({}));
jest.mock('../createMrzTextRecognizer', () => ({
  createMrzTextRecognizer: mockCreateMrzTextRecognizer,
}));

const { useMrzTextRecognizer } =
  require('../useMrzTextRecognizer') as typeof import('../useMrzTextRecognizer');

describe('useMrzTextRecognizer', () => {
  beforeEach(() => {
    mockCreateMrzTextRecognizer.mockClear();
  });

  it('creates a recognizer without a region by default', () => {
    useMrzTextRecognizer();
    expect(mockCreateMrzTextRecognizer).toHaveBeenCalledWith({});
  });

  it('passes the region of interest', () => {
    useMrzTextRecognizer({
      regionOfInterest: { x: 0, y: 0.5, width: 1, height: 0.4 },
    });
    expect(mockCreateMrzTextRecognizer).toHaveBeenCalledWith({
      regionOfInterest: { x: 0, y: 0.5, width: 1, height: 0.4 },
    });
  });

  it('depends on the region values, not the object identity', () => {
    useMrzTextRecognizer({
      regionOfInterest: { x: 0, y: 0.5, width: 1, height: 0.4 },
    });
    const first = mockLastDependencies;
    useMrzTextRecognizer({
      regionOfInterest: { x: 0, y: 0.5, width: 1, height: 0.4 },
    });
    expect(mockLastDependencies).toEqual(first);
    expect(
      mockLastDependencies.every((value) => typeof value !== 'object')
    ).toBe(true);
  });

  it('turns missing region values into NaN so validation rejects them', () => {
    const incomplete = { x: 0, y: 0.5, width: 1 } as unknown as {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    useMrzTextRecognizer({ regionOfInterest: incomplete });
    expect(mockCreateMrzTextRecognizer).toHaveBeenCalledWith({
      regionOfInterest: { x: 0, y: 0.5, width: 1, height: Number.NaN },
    });
  });
});
