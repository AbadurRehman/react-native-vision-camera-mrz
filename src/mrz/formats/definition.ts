import type { MrzFormat, MrzParseResult } from '../types';

export interface ParseContext {
  /** "Today", used to resolve two-digit years. */
  readonly referenceDate: Date;
}

/** Everything the parser needs to know about one MRZ layout. */
export interface MrzFormatDefinition {
  readonly format: MrzFormat;
  readonly lineCount: number;
  readonly lineLength: number;
  /**
   * Parses lines that already have the right shape and contain only
   * A-Z, 0-9 and `<`. Must not throw.
   */
  parse(lines: readonly string[], context: ParseContext): MrzParseResult;
}
