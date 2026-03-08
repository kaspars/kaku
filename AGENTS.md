# Agent Context

Monorepo for CJK character stroke libraries. Uses npm workspaces.

## Packages

| Package | Path | Description |
|---------|------|-------------|
| kaku | `packages/kaku/` | Stroke animation (SVG + CSS transitions) |
| kaku-ren | `packages/kaku-ren/` | Stroke practice (canvas input + evaluation) |
| kaku-3d | `packages/kaku-3d/` | 3D extruded characters (Three.js + opentype.js) |

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
├── vite.config.ts          # Dev server for demo
├── index.html              # Unified demo page (tabs for animation + practice)
├── 3d.html                 # 3D character viewer demo
├── docs/                   # Data source documentation
│   ├── kanjivg.md
│   └── animcjk.md
├── packages/
│   ├── kaku/               # Animation library
│   │   ├── AGENTS.md       # Detailed architecture
│   │   └── ...
│   ├── kaku-ren/           # Practice library
│   │   ├── AGENTS.md       # Detailed architecture
│   │   └── ...
│   └── kaku-3d/            # 3D character extrusion
│       └── src/
│           ├── font-shapes.ts    # opentype.js glyph → Three.js shapes
│           ├── extrude-model.ts  # Shape extrusion + centering/scaling
│           ├── scene.ts          # Ground plane, lighting, fog
│           └── controls.ts       # First-person camera controls
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
- AnimCJK uses a dedicated renderer (`AnimCJKRenderer`) that embeds native SVG with clip-path animation; KanjiVG uses the default `SvgRenderer`
- kaku-3d uses opentype.js to extract glyph outlines from CJK fonts (Noto Sans/Serif, Klee One), converts to Three.js shapes, and extrudes with `ExtrudeGeometry`

## Known Issues

- **Chinese Traditional 國 renders as solid block**: The 國 (U+570B) glyph in both Noto Sans TC and Noto Serif TC renders without the inner hole — the enclosed space of the 囗 radical is filled solid instead of being transparent. Other enclosed characters (圖, 關, 園) render correctly. Likely a contour winding issue specific to this glyph that causes `ShapePath.toShapes()` to misidentify the inner contour. Needs investigation.
