import { describe, expect, it, jest } from '@jest/globals';
import * as library from '../index';

jest.mock('react-native-nitro-modules', () => ({
  NitroModules: { createHybridObject: jest.fn() },
}));

describe('public API', () => {
  it('exports exactly the documented functions', () => {
    expect(Object.keys(library).sort()).toEqual([
      'computeCheckDigit',
      'createMrzTextRecognizer',
      'parseMrz',
      'useMrzTextRecognizer',
    ]);
  });
});
