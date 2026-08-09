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
├── index.html              # Unified demo page (animation / diagram / practice tabs)
├── docs/                   # Data source documentation
│   ├── kanjivg.md
│   └── animcjk.md
├── .github/workflows/
│   └── deploy.yml          # Builds the demo and deploys it to GitHub Pages
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

Runs on Node 24 — the project tracks the current LTS, and the Pages workflow
pins the same major. Tests, builds, and the dev server all run through npm
workspaces from the repo root.

Full suite: 246 tests in `kaku`, 79 in `kaku-ren`.

## Demo

`index.html` is the demo for both packages. It has three tabs — **animation**
(`Kaku`), **diagram** (`KakuDiagram`), and **practice** (`KakuRen`) — selected
via the URL hash (`#animation`, `#diagram`, `#practice`). The diagram and
practice tabs load lazily on first activation.

The demo imports TypeScript **source** directly:

```javascript
import { Kaku, ... } from './packages/kaku/src/index.ts';
import { KakuRen } from './packages/kaku-ren/src/index.ts';
```

Vite transpiles it on the fly, so `npm run dev` reflects source edits with no
package build step. `npm run build` is only needed for publishing.

Stroke data is fetched from `raw.githubusercontent.com` at runtime. The root
`vite.config.ts` declares `publicDir: 'public'`, and `public/` is gitignored —
drop a local mirror of the KanjiVG/AnimCJK SVG trees there and point the demo's
`basePath` at it to work offline or avoid rate limits.

`base: '/kaku/'` matches the GitHub Pages path. `.github/workflows/deploy.yml`
runs `npx vite build` on every push to `master` and publishes `dist/` to Pages.

## Releasing

There is no release workflow — only the Pages deploy. Releases are done by hand,
following the pattern in the git history:

1. Bump `version` in **both** `packages/kaku/package.json` and
   `packages/kaku-ren/package.json` to the same number.
2. Add a `CHANGELOG.md` entry, grouping changes per package.
3. Commit as `Bump kaku and kaku-ren to X.Y.Z` with a summary of the changes.
4. Update the READMEs and `AGENTS.md` files for anything user-visible, as a
   separate follow-up commit.
5. `npm run build`, then publish each package from its own directory.

Deprecated options are kept working and marked with `@deprecated` JSDoc rather
than removed — `width`/`height` (superseded by `size`) and `showGuide`/
`guideColor` (superseded by Kaku's `showOutline`/`outlineColor`) are the
existing examples.

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
