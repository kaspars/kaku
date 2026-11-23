import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MoeProvider } from '../../src/providers/moe-provider';
import { AnimCJKRenderer } from '../../src/renderer/animcjk-renderer';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Synthetic data in the g0v/zh-stroke-data format (2150 grid): a horizontal,
// a vertical, and the vertical again, as the scraped data sometimes repeats
// a stroke.
const fixture = readFileSync(resolve(__dirname, '../fixtures/moe-synthetic.json'), 'utf-8');

function ok(body: string) {
  return { ok: true, status: 200, text: () => Promise.resolve(body), json: () => Promise.resolve(JSON.parse(body)) };
}
const notFound = { ok: false, status: 404, text: () => Promise.resolve('') };

describe('MoeProvider', () => {
  let fetch: ReturnType<typeof vi.fn>;
  let provider: MoeProvider;

  beforeEach(() => {
    fetch = vi.fn().mockResolvedValue(ok(fixture));
    provider = new MoeProvider({ basePath: 'https://example.com/moe/', fetch });
  });

  it('requires a basePath', () => {
    expect(() => new MoeProvider({ basePath: '' })).toThrow(/basePath/);
  });

  it('handles CJK ideographs, not kana or Latin', () => {
    expect(provider.canHandle('勻')).toBe(true);
    expect(provider.canHandle('㐀')).toBe(true);
    expect(provider.canHandle('あ')).toBe(false);
    expect(provider.canHandle('A')).toBe(false);
  });

  it('fetches <basePath>/<lowercase hex code point>.json', async () => {
    await provider.getCharacter('勻');
    expect(fetch).toHaveBeenCalledWith('https://example.com/moe/52fb.json');
  });

  it('scales the 2150 grid to a 1024 viewBox and uses the tracks as stroke paths', async () => {
    const r = await provider.getCharacter('十');
    expect(r.success).toBe(true);
    if (!r.success) return;
    const d = r.data;
    expect(d.source).toBe('moe');
    expect(d.character).toBe('十');
    expect(d.codePoints).toEqual([0x5341]);
    expect(d.viewBox).toEqual([0, 0, 1024, 1024]);
    expect(d.strokes.map((s) => s.metadata.index)).toEqual([0, 1]);
    // 258 * 1024 / 2150 = 122.88; 1118 → 532.5; 1892 → 901.1; 1075 → 512
    expect(d.strokes[0].pathData).toBe('M122.9 532.5L901.1 512');
    expect(d.strokes[1].pathData).toBe('M481 122.9L491.5 512L481 901.1');
  });

  it('builds an AnimCJK-layout SVG: outlines, clip paths and timed direction paths', async () => {
    const r = await provider.getCharacter('十');
    if (!r.success) throw r.error;
    const doc = new DOMParser().parseFromString(r.data.rawSvg!, 'image/svg+xml');
    expect(doc.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 1024 1024');
    const outlines = doc.querySelectorAll('path[id]');
    expect(outlines).toHaveLength(2);
    // Q and C commands come through, scaled
    expect(outlines[0].getAttribute('d')).toBe('M102.4 512L921.6 491.5Q943 512 921.6 532.5L102.4 553Z');
    expect(outlines[1].getAttribute('d')).toMatch(/^M491\.5 102\.4C532\.5 307.2 532\.5 716\.8 491\.5 921\.6L471 102\.4Z$/);
    expect(doc.querySelectorAll('clipPath')).toHaveLength(2);
    const dirs = doc.querySelectorAll('path[clip-path]');
    expect(dirs).toHaveLength(2);
    expect(dirs[1].getAttribute('style')).toContain('--d:2s');
    expect(dirs[1].getAttribute('d')).toBe(r.data.strokes[1].pathData);
  });

  it('drops a stroke that repeats an earlier one', async () => {
    const r = await provider.getCharacter('十');
    if (!r.success) throw r.error;
    expect(r.data.strokes).toHaveLength(2);
  });

  it('keeps repeated strokes when asked', async () => {
    const p = new MoeProvider({ basePath: 'https://example.com/moe', fetch, dropDuplicates: false });
    const r = await p.getCharacter('十');
    if (!r.success) throw r.error;
    expect(r.data.strokes).toHaveLength(3);
  });

  it('renders with AnimCJKRenderer', async () => {
    const r = await provider.getCharacter('十');
    if (!r.success) throw r.error;
    const container = document.createElement('div');
    const strokes = new AnimCJKRenderer({ container, size: 200 }).render(r.data);
    expect(strokes).toHaveLength(2);
  });

  it('caches characters', async () => {
    await provider.getCharacter('十');
    await provider.getCharacter('十');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('fails, without throwing, on a missing character or bad data', async () => {
    fetch.mockResolvedValueOnce(notFound);
    expect((await provider.getCharacter('曬')).success).toBe(false);
    fetch.mockResolvedValueOnce(ok('{not json'));
    expect((await provider.getCharacter('勻')).success).toBe(false);
    fetch.mockResolvedValueOnce(ok('[]'));
    expect((await provider.getCharacter('均')).success).toBe(false);
    fetch.mockRejectedValueOnce(new Error('offline'));
    expect((await provider.getCharacter('句')).success).toBe(false);
    fetch.mockRejectedValueOnce('offline');
    expect((await provider.getCharacter('旬')).success).toBe(false);
    expect((await provider.getCharacter('')).success).toBe(false);
    expect(provider.canHandle('')).toBe(false);
  });
});
