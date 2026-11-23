import type { DataProvider, ProviderResult, CharacterData } from '../types/index.js';

/**
 * Asks providers in turn and answers from the first that has the
 * character, for example the MOE data with AnimCJK behind it. The result's
 * `source` names the provider that answered.
 *
 * Kaku renders every character with the one renderer it was given, so the
 * providers must suit it: MoeProvider and AnimCJKProvider both suit
 * AnimCJKRenderer; KanjiVGProvider needs SvgRenderer.
 */
export class FallbackProvider implements DataProvider {
  readonly id: string;

  constructor(private readonly providers: DataProvider[]) {
    if (providers.length === 0) {
      throw new Error('FallbackProvider needs at least one provider');
    }
    this.id = providers.map((p) => p.id).join('+');
  }

  canHandle(char: string): boolean {
    return this.providers.some((p) => p.canHandle(char));
  }

  async getCharacter(char: string): Promise<ProviderResult<CharacterData>> {
    const reasons: string[] = [];
    for (const p of this.providers) {
      if (!p.canHandle(char)) continue;
      const r = await p.getCharacter(char);
      if (r.success) return r;
      reasons.push(r.error.message);
    }
    return {
      success: false,
      error: new Error(reasons.length ? reasons.join('; ') : `No provider handles ${char}`),
    };
  }
}
