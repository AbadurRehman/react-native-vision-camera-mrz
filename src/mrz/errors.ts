import type { MrzParseErrorCode, MrzParseFailure } from './types';

export function parseFailure(
  code: MrzParseErrorCode,
  message: string
): MrzParseFailure {
  return { ok: false, error: { code, message } };
}
