import { describe, expect, it, jest } from '@jest/globals';
import * as library from '../index';

jest.mock('react-native-nitro-modules', () => ({
  NitroModules: { createHybridObject: jest.fn() },
}));

describe('public API', () => {
  it('exports the parser and the plugin factory', () => {
    expect(typeof library.parseMrz).toBe('function');
    expect(typeof library.computeCheckDigit).toBe('function');
    expect(typeof library.createMrzPlugin).toBe('function');
  });

  it('does not expose internal helpers', () => {
    expect(Object.keys(library).sort()).toEqual([
      'computeCheckDigit',
      'createMrzPlugin',
      'parseMrz',
    ]);
  });
});
