import { describe, expect, it } from 'vitest';
import { isPdfBytes, parsePdfFilename } from '../pdf/index.js';

describe('isPdfBytes', () => {
  it('accepts buffers starting with %PDF', () => {
    expect(isPdfBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(true);
  });
  it('rejects non-PDF buffers', () => {
    expect(isPdfBytes(new Uint8Array([0x7b, 0x22, 0x6f, 0x6b]))).toBe(false); // {"ok
    expect(isPdfBytes(new Uint8Array([0x25]))).toBe(false); // too short
    expect(isPdfBytes(new Uint8Array([]))).toBe(false);
  });
});

describe('parsePdfFilename', () => {
  it('parses plain filename form', () => {
    expect(parsePdfFilename('attachment; filename="mandado-123.pdf"')).toBe('mandado-123.pdf');
  });
  it('parses RFC 5987 filename* form', () => {
    expect(parsePdfFilename("attachment; filename*=UTF-8''mandado%20123.pdf")).toBe(
      'mandado 123.pdf',
    );
  });
  it('prefers filename* over plain when both present', () => {
    expect(
      parsePdfFilename('attachment; filename="fallback.pdf"; filename*=UTF-8\'\'real.pdf'),
    ).toBe('real.pdf');
  });
  it('returns null for missing / non-string', () => {
    expect(parsePdfFilename(undefined)).toBeNull();
    expect(parsePdfFilename('attachment')).toBeNull();
    expect(parsePdfFilename(123)).toBeNull();
  });
});
