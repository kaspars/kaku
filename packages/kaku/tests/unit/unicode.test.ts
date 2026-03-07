import { describe, it, expect } from 'vitest';
import { toHex, getCodePoints } from '../../src/utils/unicode';

describe('unicode utilities', () => {
  describe('toHex', () => {
    it('should convert ASCII character to hex', () => {
      expect(toHex('A')).toBe('00041');
    });

    it('should convert kanji to 5-digit hex', () => {
      // 漢 = U+6F22
      expect(toHex('漢')).toBe('06f22');
    });

    it('should convert kanji with 4-digit code point', () => {
      // 奸 = U+5978
      expect(toHex('奸')).toBe('05978');
    });

    it('should handle surrogate pairs (emoji)', () => {
      // 𠀀 = U+20000 (CJK Extension B)
      expect(toHex('𠀀')).toBe('20000');
    });

    it('should pad to custom length', () => {
      expect(toHex('A', 4)).toBe('0041');
      expect(toHex('A', 8)).toBe('00000041');
    });

    it('should throw on empty string', () => {
      expect(() => toHex('')).toThrow('Invalid character: empty string');
    });

    it('should return lowercase hex', () => {
      // 漢 = U+6F22 (has uppercase letters in hex)
      expect(toHex('漢')).toBe('06f22');
      expect(toHex('漢')).not.toContain('F');
    });
  });

  describe('getCodePoints', () => {
    it('should return code points for ASCII', () => {
      expect(getCodePoints('ABC')).toEqual([65, 66, 67]);
    });

    it('should return code points for CJK characters', () => {
      expect(getCodePoints('漢字')).toEqual([0x6f22, 0x5b57]);
    });

    it('should handle surrogate pairs correctly', () => {
      // 𠀀 = U+20000
      expect(getCodePoints('𠀀')).toEqual([0x20000]);
    });

    it('should handle mixed content', () => {
      expect(getCodePoints('A漢𠀀')).toEqual([65, 0x6f22, 0x20000]);
    });

    it('should return empty array for empty string', () => {
      expect(getCodePoints('')).toEqual([]);
    });
  });
});
