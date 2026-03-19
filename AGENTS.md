# Agent Context

Monorepo for CJK character stroke libraries. Uses npm workspaces.

## Packages

| Package | Path | Description |
|---------|------|-------------|
| kaku | `packages/kaku/` | Stroke animation (SVG + CSS transitions) |
| kaku-ren | `packages/kaku-ren/` | Stroke practice (canvas input + evaluation) |

kaku-ren depends on kaku. kaku is standalone.

## Data Providers

Two data providers are available for character stroke data:

| Provider | Characters | Source |
|----------|-----------|--------|
| KanjiVGProvider | Japanese kanji + kana | [KanjiVG](http://kanjivg.tagaini.net/) |
| AnimCJKProvider | Japanese, Chinese (simplified/traditional), Korean | [AnimCJK](https://github.com/parsimonhi/animCJK) |

Each provider fetches SVG files from a configurable base URL and normalizes them into `CharacterData`. AnimCJK also stores `rawSvg` for native rendering via `AnimCJKRenderer`.

See `docs/kanjivg.md` and `docs/animcjk.md` for detailed format documentation.

## Structure

```
├── package.json            # Workspace root
├── CHANGELOG.md            # Release history
├── vite.config.ts          # Dev server for demo
├── index.html              # Unified demo page (tabs for animation + practice)
├── docs/                   # Data source documentation
│   ├── kanjivg.md
│   └── animcjk.md
├── packages/
│   ├── kaku/               # Animation library
│   │   ├── AGENTS.md       # Detailed architecture
│   │   └── ...
│   └── kaku-ren/           # Practice library
│       ├── AGENTS.md       # Detailed architecture
│       └── ...
```

## Commands

```bash
npm run dev              # Demo server
npm test                 # All tests
npm test -w @kaspars/kaku        # Kaku tests only
npm test -w @kaspars/kaku-ren    # Kaku Ren tests only
npm run build            # Build all packages
```

## Key Decisions

- npm workspaces (not pnpm/yarn)
- Each package has its own vite.config.ts (library build) and vitest.config.ts (tests)
- Root vite.config.ts is only for the demo server
- Single demo page with tabs for both packages
- Data is fetched remotely (raw.githubusercontent.com) — no bundled SVGs
- Both providers cache `CharacterData` in memory after the first fetch
- AnimCJK uses a dedicated renderer (`AnimCJKRenderer`) that embeds native SVG with clip-path animation; KanjiVG uses the default `SvgRenderer`
- KakuRen construction order is flexible (before or after `kaku.load()`); `refresh()` must be called after every `load()`
- Both packages are versioned and released together
