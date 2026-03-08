import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnimCJKProvider } from '../../src/providers/animcjk-provider';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load fixtures
const kanjiFixture = readFileSync(
  resolve(__dirname, '../fixtures/animcjk-23383.svg'),
  'utf-8',
);
const kanaFixture = readFileSync(
  resolve(__dirname, '../fixtures/animcjk-12354.svg'),
  'utf-8',
);

describe('AnimCJKProvider', () => {
  let provider: AnimCJKProvider;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    provider = new AnimCJKProvider({
      basePath: 'https://example.com/animcjk',
      fetch: mockFetch,
    });
  });

  describe('canHandle', () => {
    it('should handle CJK Unified Ideographs', () => {
      expect(provider.canHandle('字')).toBe(true); // U+5B57
      expect(provider.canHandle('漢')).toBe(true); // U+6F22
    });

    it('should handle CJK Extension A', () => {
      expect(provider.canHandle('\u3400')).toBe(true);
      expect(provider.canHandle('\u4DBF')).toBe(true);
    });

    it('should handle hiragana for Japanese language', () => {
      expect(provider.canHandle('あ')).toBe(true); // U+3042
      expect(provider.canHandle('ん')).toBe(true); // U+3093
    });

    it('should handle katakana for Japanese language', () => {
      expect(provider.canHandle('ア')).toBe(true); // U+30A2
      expect(provider.canHandle('ン')).toBe(true); // U+30F3
    });

    it('should not handle kana for non-Japanese language', () => {
      const zhProvider = new AnimCJKProvider({
        basePath: 'https://example.com/animcjk',
        language: 'zh-Hans',
        fetch: mockFetch,
      });
      expect(zhProvider.canHandle('あ')).toBe(false);
      expect(zhProvider.canHandle('ア')).toBe(false);
      // But CJK should still work
      expect(zhProvider.canHandle('字')).toBe(true);
    });

    it('should not handle ASCII', () => {
      expect(provider.canHandle('A')).toBe(false);
      expect(provider.canHandle('1')).toBe(false);
    });

    it('should not handle emoji', () => {
      expect(provider.canHandle('😀')).toBe(false);
    });

    it('should not handle empty string', () => {
      expect(provider.canHandle('')).toBe(false);
    });
  });

  describe('getCharacter', () => {
    it('should construct correct URL with decimal codepoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(kanjiFixture),
      });

      await provider.getCharacter('字'); // U+5B57 = 23383 decimal

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/animcjk/svgsJa/23383.svg',
      );
    });

    it('should handle trailing slash in basePath', async () => {
      const providerWithSlash = new AnimCJKProvider({
        basePath: 'https://example.com/animcjk/',
        fetch: mockFetch,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(kanjiFixture),
      });

      await providerWithSlash.getCharacter('字');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/animcjk/svgsJa/23383.svg',
      );
    });

    it('should try kana directory as fallback for Japanese', async () => {
      // First call (svgsJa) fails, second call (svgsJaKana) succeeds
      mockFetch
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(kanaFixture),
        });

      const result = await provider.getCharacter('あ'); // U+3042 = 12354 decimal

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://example.com/animcjk/svgsJa/12354.svg',
      );
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://example.com/animcjk/svgsJaKana/12354.svg',
      );
      expect(result.success).toBe(true);
    });

    it('should use correct directory for zh-Hans', async () => {
      const zhProvider = new AnimCJKProvider({
        basePath: 'https://example.com/animcjk',
        language: 'zh-Hans',
        fetch: mockFetch,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(kanjiFixture),
      });

      await zhProvider.getCharacter('字');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/animcjk/svgsZhHans/23383.svg',
      );
    });

    it('should use correct directory for zh-Hant', async () => {
      const zhProvider = new AnimCJKProvider({
        basePath: 'https://example.com/animcjk',
        language: 'zh-Hant',
        fetch: mockFetch,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(kanjiFixture),
      });

      await zhProvider.getCharacter('字');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/animcjk/svgsZhHant/23383.svg',
      );
    });

    it('should use correct directory for Korean', async () => {
      const koProvider = new AnimCJKProvider({
        basePath: 'https://example.com/animcjk',
        language: 'ko',
        fetch: mockFetch,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(kanjiFixture),
      });

      await koProvider.getCharacter('字');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/animcjk/svgsKo/23383.svg',
      );
    });

    it('should return success result with parsed data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(kanjiFixture),
      });

      const result = await provider.getCharacter('字');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.character).toBe('字');
        expect(result.data.codePoints).toEqual([0x5b57]);
        expect(result.data.viewBox).toEqual([0, 0, 1024, 1024]);
        expect(result.data.source).toBe('animcjk');
        expect(result.data.rawSvg).toBe(kanjiFixture);
        expect(result.data.strokes).toHaveLength(6);
      }
    });

    it('should extract strokes in correct order by delay', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(kanjiFixture),
      });

      const result = await provider.getCharacter('字');

      expect(result.success).toBe(true);
      if (result.success) {
        const { strokes } = result.data;

        // Verify indexes
        strokes.forEach((stroke, index) => {
          expect(stroke.metadata.index).toBe(index);
        });

        // Verify sourceId references clip-path IDs
        expect(strokes[0].metadata.sourceId).toBe('z23383c1');
        expect(strokes[5].metadata.sourceId).toBe('z23383c6');
      }
    });

    it('should extract direction polyline path data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(kanjiFixture),
      });

      const result = await provider.getCharacter('字');

      expect(result.success).toBe(true);
      if (result.success) {
        // Stroke 1: simple 3-point polyline
        expect(result.data.strokes[0].pathData).toBe(
          'M432 56L516 93L572 151',
        );
        // Stroke 6: 4-point polyline
        expect(result.data.strokes[5].pathData).toBe(
          'M130 613L191 631L830 563L917 583',
        );
      }
    });

    it('should group multi-part strokes by shared delay', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(kanaFixture),
      });

      const result = await provider.getCharacter('あ');

      expect(result.success).toBe(true);
      if (result.success) {
        // あ has 3 strokes: d1, d2, d3a+d3b (multi-part)
        expect(result.data.strokes).toHaveLength(3);

        // Stroke 3 should concatenate both polylines
        const stroke3 = result.data.strokes[2];
        expect(stroke3.pathData).toContain('570,440');
        expect(stroke3.pathData).toContain('-170,442');

        // sourceId should list both clip-path IDs
        expect(stroke3.metadata.sourceId).toBe('z12354c3a,z12354c3b');
      }
    });

    it('should return error when character not found', async () => {
      mockFetch.mockResolvedValue({ ok: false });

      const result = await provider.getCharacter('字');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Character not found');
        expect(result.error.message).toContain('ja');
      }
    });

    it('should return error on fetch failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await provider.getCharacter('字');

      // All directories fail, returns not-found error
      expect(result.success).toBe(false);
    });

    it('should return error for invalid character', async () => {
      const result = await provider.getCharacter('');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Invalid character');
      }
    });

    it('should return error when SVG element is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            '<?xml version="1.0"?><html><body>Not SVG</body></html>',
          ),
      });

      const result = await provider.getCharacter('字');

      expect(result.success).toBe(false);
    });

    it('should use default viewBox when attribute is missing', async () => {
      const svgWithoutViewBox = `<svg xmlns="http://www.w3.org/2000/svg">
        <path id="z23383d1" d="M10 10Z"/>
        <defs><clipPath id="z23383c1"><use href="#z23383d1"/></clipPath></defs>
        <path style="--d:1s;" pathLength="3333" clip-path="url(#z23383c1)" d="M10 10L20 20"/>
      </svg>`;
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(svgWithoutViewBox),
      });

      const result = await provider.getCharacter('字');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.viewBox).toEqual([0, 0, 1024, 1024]);
      }
    });

    it('should handle SVG with no stroke paths gracefully', async () => {
      const svgNoStrokes = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
        <path id="z23383d1" d="M10 10Z"/>
      </svg>`;
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(svgNoStrokes),
      });

      const result = await provider.getCharacter('字');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.strokes).toHaveLength(0);
      }
    });
  });

  describe('id property', () => {
    it('should have correct id', () => {
      expect(provider.id).toBe('animcjk');
    });
  });
});
