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
| `src/providers/moe-provider.ts` | Fetches Taiwan MOE JSON (g0v), drops repeated strokes, builds AnimCJK-layout SVG |
| `src/providers/fallback-provider.ts` | Chains providers; first that has the character answers |
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

### Control flow subtleties

`StrokeAnimator` sequences strokes with a `setTimeout` per stroke rather than
tracking CSS transition events. Several behaviours follow from that and are easy
to get wrong when editing:

- **`pause()` stops sequencing, it does not freeze a stroke.** The pending
  timeout is cleared, but a stroke already mid-transition finishes drawing on
  screen. `isAnimatingStroke` is cleared too, so the paused stroke's
  `strokeComplete` never fires and `currentStroke` does not advance.
- **`nextStroke()` while playing** pauses, then — if a stroke was mid-flight —
  completes it instantly and advances past it, before animating the next one.
- **`previousStroke()` while playing** cancels and hides the in-flight stroke
  and returns; the cancel *is* the step back, so the index does not decrement.
  Only when nothing is animating does it decrement and hide the prior stroke.
- **Instant show/hide re-arms the transition.** `showStrokeInstantly()`,
  `hideStroke()`, and `reset()` clear the transition, set the value, force a
  reflow via `getBoundingClientRect()`, then restore the transition. Dropping
  the reflow makes the "instant" change animate instead.
- **Looping splits `loopDelay` in half** — wait half, `reset()` to a clean pad,
  wait the other half, then `play()`.
- **Handler exceptions are swallowed.** `emit()` wraps each listener in
  try/catch and logs to `console.error`, so one bad subscriber cannot break the
  animation.

### Transition channels on `RenderedStroke`

`element.style.transition` is a single CSS declaration, but `RenderedStroke`
exposes two independent channels — dashoffset (`setTransition`/
`clearTransition`) and opacity (`setOpacityTransition`/
`clearOpacityTransition`). Both `stroke-path.ts` and `animcjk-renderer.ts`
therefore keep the two strings in closure variables and recompose the whole
declaration on every change; clearing a channel drops it from the list and
falls back to `'none'` when neither is active.

Do not write `element.style.transition` directly from a setter. That was the
original implementation, and it meant the two setters clobbered each other and
either `clear*` wiped both. It was invisible only because the effect branches
are mutually exclusive — a combined draw-and-fade effect would have broken.

### AnimCJKRenderer specifics

`AnimCJKRenderer` embeds the source SVG but **removes its `<style>` elements**,
replacing them with its own rules — otherwise AnimCJK's embedded `@keyframes`
would self-animate and fight the animator. It then re-creates the visibility
control in JS:

- Shape paths (`path[id]`) are filled with `outlineColor` when `showOutline` is
  set, otherwise `fill: none`.
- Stroke polylines (`path[clip-path]`) get `stroke-width: 128` and are revealed
  via `stroke-dashoffset`, clipped to their shape outline.
- Path length is hardcoded to `3337` (matching AnimCJK's own dasharray) instead
  of measured with `getTotalLength()`, so the sweep speed stays consistent
  across strokes.
- Multi-part strokes share a `--d` delay; every element in the group is updated
  together by the returned `RenderedStroke`, whose `element` is the first part.

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
4. Accept a constructor options object shaped like `RendererFactoryOptions`
   (`container`, `size`, `width`, `height`) so users can pass
   `renderer: (options) => new MyRenderer(options)` to `Kaku` without an adapter
5. Export from `src/index.ts`

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
