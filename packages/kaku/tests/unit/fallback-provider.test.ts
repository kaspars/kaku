import { describe, it, expect, vi } from 'vitest';
import { FallbackProvider } from '../../src/providers/fallback-provider';
import type { CharacterData, DataProvider } from '../../src/types';

function provider(id: string, chars: string, handles = /./u): DataProvider & { getCharacter: ReturnType<typeof vi.fn> } {
  return {
    id,
    canHandle: (c: string) => handles.test(c),
    getCharacter: vi.fn(async (c: string) =>
      chars.includes(c)
        ? { success: true as const, data: { character: c, codePoints: [c.codePointAt(0)!], viewBox: [0, 0, 1024, 1024], strokes: [], source: id } as CharacterData }
        : { success: false as const, error: new Error(`${id}: no ${c}`) },
    ),
  };
}

describe('FallbackProvider', () => {
  it('needs at least one provider', () => {
    expect(() => new FallbackProvider([])).toThrow();
  });

  it('answers from the first provider that has the character', async () => {
    const moe = provider('moe', '勻均');
    const animcjk = provider('animcjk', '均曬');
    const p = new FallbackProvider([moe, animcjk]);
    const a = await p.getCharacter('均');
    expect(a.success && a.data.source).toBe('moe');
    expect(animcjk.getCharacter).not.toHaveBeenCalled();
    const b = await p.getCharacter('曬');
    expect(b.success && b.data.source).toBe('animcjk');
  });

  it('skips providers that cannot handle the character', async () => {
    const kanaOnly = provider('kana', 'あ', /\p{Script=Hiragana}/u);
    const all = provider('all', 'あ字');
    const p = new FallbackProvider([kanaOnly, all]);
    expect(p.canHandle('字')).toBe(true);
    await p.getCharacter('字');
    expect(kanaOnly.getCharacter).not.toHaveBeenCalled();
  });

  it('fails with every reason when nobody has it', async () => {
    const p = new FallbackProvider([provider('a', ''), provider('b', '')]);
    const r = await p.getCharacter('曬');
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.message).toContain('a: no 曬');
    expect(r.error.message).toContain('b: no 曬');
  });

  it('cannot handle what no provider handles', () => {
    expect(new FallbackProvider([provider('kana', '', /\p{Script=Hiragana}/u)]).canHandle('字')).toBe(false);
  });

  it('has a combined id', () => {
    expect(new FallbackProvider([provider('moe', ''), provider('animcjk', '')]).id).toBe('moe+animcjk');
  });
});
