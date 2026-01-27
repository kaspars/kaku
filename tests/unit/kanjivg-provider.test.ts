import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KanjiVGProvider } from '../../src/providers/kanjivg-provider';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load fixture
const fixturePath = resolve(__dirname, '../fixtures/kanjivg-05978.svg');
const fixtureContent = readFileSync(fixturePath, 'utf-8');

describe('KanjiVGProvider', () => {
  let provider: KanjiVGProvider;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    provider = new KanjiVGProvider({
      basePath: 'https://example.com/kanjivg',
      fetch: mockFetch,
    });
  });

  describe('canHandle', () => {
    it('should handle CJK Unified Ideographs', () => {
      expect(provider.canHandle('漢')).toBe(true); // U+6F22
      expect(provider.canHandle('字')).toBe(true); // U+5B57
      expect(provider.canHandle('奸')).toBe(true); // U+5978
    });

    it('should handle hiragana', () => {
      expect(provider.canHandle('あ')).toBe(true); // U+3042
      expect(provider.canHandle('ん')).toBe(true); // U+3093
    });

    it('should handle katakana', () => {
      expect(provider.canHandle('ア')).toBe(true); // U+30A2
      expect(provider.canHandle('ン')).toBe(true); // U+30F3
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
    it('should construct correct URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(fixtureContent),
      });

      await provider.getCharacter('奸');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/kanjivg/05978.svg'
      );
    });

    it('should handle trailing slash in basePath', async () => {
      const providerWithSlash = new KanjiVGProvider({
        basePath: 'https://example.com/kanjivg/',
        fetch: mockFetch,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(fixtureContent),
      });

      await providerWithSlash.getCharacter('奸');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/kanjivg/05978.svg'
      );
    });

    it('should return success result with parsed data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(fixtureContent),
      });

      const result = await provider.getCharacter('奸');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.character).toBe('奸');
        expect(result.data.codePoints).toEqual([0x5978]);
        expect(result.data.viewBox).toEqual([0, 0, 109, 109]);
        expect(result.data.source).toBe('kanjivg');
        expect(result.data.strokes).toHaveLength(6);
      }
    });

    it('should extract strokes in correct order', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(fixtureContent),
      });

      const result = await provider.getCharacter('奸');

      expect(result.success).toBe(true);
      if (result.success) {
        const { strokes } = result.data;

        // Verify stroke order
        expect(strokes[0].metadata.sourceId).toBe('kvg:05978-s1');
        expect(strokes[1].metadata.sourceId).toBe('kvg:05978-s2');
        expect(strokes[2].metadata.sourceId).toBe('kvg:05978-s3');
        expect(strokes[3].metadata.sourceId).toBe('kvg:05978-s4');
        expect(strokes[4].metadata.sourceId).toBe('kvg:05978-s5');
        expect(strokes[5].metadata.sourceId).toBe('kvg:05978-s6');

        // Verify indexes
        strokes.forEach((stroke, index) => {
          expect(stroke.metadata.index).toBe(index);
        });
      }
    });

    it('should extract stroke types', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(fixtureContent),
      });

      const result = await provider.getCharacter('奸');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.strokes[0].metadata.type).toBe('㇛');
        expect(result.data.strokes[1].metadata.type).toBe('㇒');
        expect(result.data.strokes[5].metadata.type).toBe('㇑');
      }
    });

    it('should extract path data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(fixtureContent),
      });

      const result = await provider.getCharacter('奸');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.strokes[0].pathData).toContain('M28.48,16.87');
      }
    });

    it('should return error on HTTP failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await provider.getCharacter('奸');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('404');
      }
    });

    it('should return error on fetch failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await provider.getCharacter('奸');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Network error');
      }
    });

    it('should return error on invalid SVG', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('not valid xml'),
      });

      const result = await provider.getCharacter('奸');

      // DOMParser doesn't throw on invalid XML in jsdom, it returns an error document
      // The behavior may vary, but we should handle it gracefully
      expect(result.success).toBe(false);
    });

    it('should return error when SVG element is missing', async () => {
      const noSvgContent = '<?xml version="1.0"?><html><body>Not SVG</body></html>';
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(noSvgContent),
      });

      const result = await provider.getCharacter('奸');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('No SVG element found');
      }
    });

    it('should use default viewBox when attribute is missing', async () => {
      const svgWithoutViewBox = `<?xml version="1.0"?>
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:kvg="http://kanjivg.tagaini.net">
          <path id="kvg:05978-s1" d="M10,10 L20,20"/>
        </svg>`;
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(svgWithoutViewBox),
      });

      const result = await provider.getCharacter('奸');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.viewBox).toEqual([0, 0, 109, 109]);
      }
    });

    it('should use default viewBox when format is invalid', async () => {
      const svgWithBadViewBox = `<?xml version="1.0"?>
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:kvg="http://kanjivg.tagaini.net" viewBox="invalid">
          <path id="kvg:05978-s1" d="M10,10 L20,20"/>
        </svg>`;
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(svgWithBadViewBox),
      });

      const result = await provider.getCharacter('奸');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.viewBox).toEqual([0, 0, 109, 109]);
      }
    });

    it('should use default viewBox when viewBox has wrong number of values', async () => {
      const svgWithPartialViewBox = `<?xml version="1.0"?>
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:kvg="http://kanjivg.tagaini.net" viewBox="0 0 100">
          <path id="kvg:05978-s1" d="M10,10 L20,20"/>
        </svg>`;
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(svgWithPartialViewBox),
      });

      const result = await provider.getCharacter('奸');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.viewBox).toEqual([0, 0, 109, 109]);
      }
    });

    it('should return error when path is missing d attribute', async () => {
      const svgWithMissingD = `<?xml version="1.0"?>
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:kvg="http://kanjivg.tagaini.net" viewBox="0 0 109 109">
          <path id="kvg:05978-s1"/>
        </svg>`;
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(svgWithMissingD),
      });

      const result = await provider.getCharacter('奸');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Path missing d attribute');
      }
    });

    it('should handle non-Error thrown values', async () => {
      mockFetch.mockRejectedValue('string error');

      const result = await provider.getCharacter('奸');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Unknown error occurred');
      }
    });
  });

  describe('id property', () => {
    it('should have correct id', () => {
      expect(provider.id).toBe('kanjivg');
    });
  });
});
