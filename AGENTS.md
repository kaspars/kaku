# Agent Context

Monorepo for CJK character stroke libraries. Uses npm workspaces.

## Packages

| Package | Path | Description |
|---------|------|-------------|
| kaku | `packages/kaku/` | Stroke animation (SVG + CSS transitions) |
| kaku-ren | `packages/kaku-ren/` | Stroke practice (canvas input + evaluation) |

kaku-ren depends on kaku. kaku is standalone.

## Structure

```
├── package.json            # Workspace root
├── vite.config.ts          # Dev server for demo
├── index.html              # Unified demo page
├── public/kanjivg/         # KanjiVG SVG data (gitignored)
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
npm test -w kaku         # Kaku tests only
npm test -w kaku-ren     # Kaku Ren tests only
npm run build            # Build all packages
```

## Key Decisions

- npm workspaces (not pnpm/yarn)
- Each package has its own vite.config.ts (library build) and vitest.config.ts (tests)
- Root vite.config.ts is only for the demo server
- Single demo page with tabs for both packages
- KanjiVG data in root public/ (shared)
