import type { MrzFormatDefinition } from './definition';
import { td3 } from './td3';

/** Supported layouts. Add TD1, TD2 and visa layouts here as they are implemented. */
const FORMATS: readonly MrzFormatDefinition[] = [td3];

/** Finds the layout whose line count and line length match the input. */
export function findFormat(
  lines: readonly string[]
): MrzFormatDefinition | undefined {
  return FORMATS.find(
    (format) =>
      lines.length === format.lineCount &&
      lines.every((line) => line.length === format.lineLength)
  );
}

/** e.g. `TD3 (2 lines of 44 characters)` */
export function describeSupportedFormats(): string {
  return FORMATS.map(
    (format) =>
      `${format.format} (${format.lineCount} lines of ${format.lineLength} characters)`
  ).join(' or ');
}
