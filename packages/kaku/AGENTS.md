# Kaku - Agent Context

This document provides context for AI assistants working on the Kaku codebase.

## Project Overview

Kaku is a TypeScript library for animating CJK (Chinese/Japanese/Korean) character strokes. It uses a pluggable architecture for data providers and CSS transitions for smooth animation.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                          Kaku                            │
│                 (Animated Stroke Display)                │
├──────────────────────────────────────────────────────────┤
│                          │                               │
│   ┌───────────────────┐  │  ┌──────────────────────┐     │
│   │   DataProvider    │──┼─▶│     Renderer         │     │
│   │ KanjiVG / AnimCJK │  │  │ SvgRenderer (default)│     │
│   └───────────────────┘  │  │ AnimCJKRenderer      │     │
│                          │  └──────────────────────┘     │
│                          │           │                   │
│                          │           ▼                   │
│                          │  ┌──────────────────────┐     │
│                          └─▶│   StrokeAnimator     │     │
│                             │  (CSS transitions)   │     │
│                             └──────────────────────┘     │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                       KakuDiagram                        │
│              (Static Stroke Order Diagrams)              │
├──────────────────────────────────────────────────────────┤
│                          │                               │
│   ┌───────────────────┐  │  ┌──────────────────────┐     │
│   │   DataProvider    │──┼─▶│  N x SVG Elements    │     │
│   │ KanjiVG / AnimCJK │  │  │  (cumulative view)   │     │
│   └───────────────────┘  │  └──────────────────────┘     │
│                                                          │
│   Output: SVG1(stroke 1), SVG2(1-2), ... SVGn(all)       │
└──────────────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `src/core/kaku.ts` | Main API class, orchestrates animation components |
| `src/core/kaku-diagram.ts` | Renders stroke order diagrams as multiple SVGs |
| `src/providers/kanjivg-provider.ts` | Fetches and parses KanjiVG SVG files |
| `src/providers/animcjk-provider.ts` | Fetches and parses AnimCJK SVG files |
| `src/renderer/svg-renderer.ts` | Default renderer for KanjiVG (creates SVG paths) |
| `src/renderer/animcjk-renderer.ts` | Renderer for AnimCJK (embeds native SVG with clip-path) |
| `src/renderer/stroke-path.ts` | Wraps path elements with animation methods |
| `src/animator/stroke-animator.ts` | Controls animation timing and state |
| `src/types/` | TypeScript interfaces |
| `src/utils/unicode.ts` | Unicode helper functions |
| `src/utils/svg.ts` | SVG element creation helpers |

## Animation Technique

The animator supports multiple stroke effects via the `strokeEffect` option:

### Draw Effect (default)

Uses CSS `stroke-dashoffset` technique:

1. Each path has `stroke-dasharray` set to its total length
2. `stroke-dashoffset` starts at the path length (hidden)
3. Animate `stroke-dashoffset` to 0 (revealed)
4. CSS transitions provide smooth animation

```typescript
// In stroke-path.ts
element.style.strokeDasharray = String(length);
element.style.strokeDashoffset = String(length);  // Hidden
element.style.transition = 'stroke-dashoffset 0.5s ease';
element.style.strokeDashoffset = '0';  // Triggers animation
```

### Fade Effect

Uses CSS `opacity` transition:

1. Path is fully drawn but opacity starts at 0
2. Animate opacity to 1 (revealed)

### None Effect

Strokes appear instantly with no animation, but still respect `strokeDuration` as delay between strokes.

## Data Flow

1. User calls `kaku.load('漢')`
2. Kaku asks provider for character data
3. Provider fetches SVG, parses paths, extracts strokes
4. Kaku passes data to renderer
5. Renderer creates SVG with path elements
6. Animator receives rendered strokes
7. User calls `play()` to start animation

## Data Providers

Two providers are available. See `docs/kanjivg.md` and `docs/animcjk.md` for detailed format docs.

Both providers cache `CharacterData` in a `Map<string, CharacterData>` after the first successful fetch. Repeat `load()` calls for the same character skip the network entirely.

### KanjiVG

- 109x109 viewBox, hex codepoint filenames (`05b57.svg`)
- Single Bezier path per stroke, uses default `SvgRenderer`
- Covers Japanese kanji + kana

### AnimCJK

- 1024x1024 viewBox, decimal codepoint filenames (`23383.svg`)
- Dual-path model: shape outlines (clip regions) + direction polylines (animation)
- Requires `AnimCJKRenderer` which embeds the native SVG and controls strokes via `stroke-dashoffset` on polylines clipped to shape outlines
- Stores `rawSvg` on `CharacterData` for the renderer
- Multi-part strokes grouped by shared `--d` CSS delay value
- Covers Japanese, Chinese (simplified/traditional), Korean

## State Machine

The animator has these states:

```
     load()
       │
       ▼
    ┌──────┐  play()   ┌─────────┐
    │ idle │──────────▶│ playing │
    └──────┘           └─────────┘
       ▲                    │
       │   reset()          │ pause()
       │                    ▼
       │               ┌────────┐
       └───────────────│ paused │
       │               └────────┘
       │
       │               ┌───────────┐
       └───────────────│ completed │
          reset()      └───────────┘
```

## Testing

Tests use Vitest with jsdom. Key considerations:

- `getTotalLength()` is mocked (jsdom doesn't implement it)
- Use `vi.advanceTimersByTimeAsync()` for Promise-based timing
- Fixtures are in `tests/fixtures/`

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## Common Tasks

### Adding a New Provider

1. Create `src/providers/my-provider.ts`
2. Implement `DataProvider` interface
3. If the data format needs custom rendering, create a `Renderer` implementation
4. Export from `src/index.ts`
5. Add tests in `tests/unit/my-provider.test.ts`

### Adding a New Renderer

1. Create `src/renderer/my-renderer.ts`
2. Implement `Renderer` interface (render, getSvg, clear, dispose)
3. Return `RenderedStroke` objects with setProgress/setOpacity/setTransition methods
4. Export from `src/index.ts`

### Adding Animation Events

1. Add event type to `AnimationEventType` in `src/types/animator.ts`
2. Emit event in `StrokeAnimator` using `this.emit({ type: 'newEvent' })`
3. Add tests for the new event

### Modifying Render Options

1. Add option to `RenderOptions` in `src/types/renderer.ts`
2. Handle in `SvgRenderer.render()`
3. Pass through from `KakuOptions` in `src/core/kaku.ts`
4. If the option needs to be changeable at runtime (like `showOutline`), add a dedicated setter on `Kaku` that updates `renderOptions` and calls `renderer.render()` + `animator.setStrokes()` — see `setShowOutline()` as the reference pattern
5. If applicable to diagrams, also update `KakuDiagram`

### Adding Stroke Effects

1. Add effect name to `StrokeEffect` type in `src/types/animator.ts`
2. Handle initialization in `StrokeAnimator.setStrokes()`
3. Handle reset in `StrokeAnimator.reset()`
4. Handle show/hide in `showStrokeAnimated()`, `showStrokeInstantly()`, `hideStroke()`
5. Add tests for new effect

## Build Output

```
dist/
├── kaku.js     # ESM bundle
├── kaku.cjs    # CommonJS bundle
└── *.d.ts      # Type declarations
```

## Dependencies

- **Runtime**: None (browser APIs only)
- **Dev**: TypeScript, Vite, Vitest, jsdom
