# Kaku Ren - Agent Context

## Overview

Stroke practice library that adds interactive drawing input and evaluation on top of Kaku's animation engine. Users draw strokes on a canvas overlay and receive feedback on accuracy. Works with both KanjiVG and AnimCJK data providers.

## Architecture

```
┌───────────────────────────────────────────────────┐
│                     KakuRen                       │
│               (Practice Orchestrator)             │
├───────────────────────────────────────────────────┤
│                                                   │
│  ┌──────────────┐  ┌──────────────┐              │
│  │  StrokeInput │  │    Kaku      │ (dependency) │
│  │ (canvas I/O) │  │ (animation)  │              │
│  └──────┬───────┘  └──────────────┘              │
│         │                                         │
│         ▼                                         │
│  ┌──────────────────┐                             │
│  │ StrokeEvaluator  │                             │
│  │ (score strokes)  │                             │
│  └──────────────────┘                             │
│                                                   │
└───────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `src/kaku-ren.ts` | Orchestrator: input, evaluation, Kaku animation, hints |
| `src/stroke-input.ts` | Canvas overlay, pointer event handling, point capture |
| `src/stroke-evaluator.ts` | Pure function: resampling, distance scoring, direction check |
| `src/types.ts` | TypeScript interfaces (Point, EvaluationResult, etc.) |

## Initialization Order

`KakuRen` can be constructed before or after `kaku.load()` — either order is safe. `setupLayering()` (which sets z-index on the Kaku SVG element) is deferred to `refresh()` rather than running in the constructor. The required call sequence is:

```
new Kaku(...)       ┐
new KakuRen(...)    ├─ any order
await kaku.load()   ┘
kakuRen.refresh()   ← must follow every kaku.load()
```

## Required Kaku Configuration

When using KakuRen, the Kaku instance must be created with:

```typescript
animation: { autoplay: false, strokeEffect: 'none', strokeDuration: 0 }
```

Without `strokeEffect: 'none'`, Kaku re-animates each accepted stroke after KakuRen's morph completes, causing a visible double-draw.

## refresh()

`refresh()` must be called after every `kaku.load()`. It:

1. Calls `setupLayering()` — sets `position: relative; z-index: 2` on the Kaku SVG
2. Validates that the KakuRen `size` matches the Kaku SVG dimensions — throws a descriptive error if they differ
3. Removes and re-creates the guide overlay (if `showGuide: true`)
4. Clears scores, cached sampled points, and re-enables input
5. Recomputes canvas stroke width to match the new SVG (unless `strokeWidth` was explicit)

## Evaluation Algorithm

1. Resample both expected and user strokes to N equidistant points (N=50)
2. Convert user points from canvas coords to viewBox space (109x109 for KanjiVG, 1024x1024 for AnimCJK)
3. Compute average Euclidean distance between corresponding points
4. Normalize by expected stroke length (scale-invariant)
5. Reject if user stroke length < 2/3 of expected
6. Apply length-based boost for short strokes (< 20 units)
7. Score = 1 - normalizedDistance / (threshold * boost), clamped to [0, 1]

Sampled points for each path are cached in `sampledPointsCache` and cleared on `refresh()`.

### Direction checking

Compare stroke direction by checking proximity of start/end points to expected start/end vs reversed. Wrong direction results in immediate rejection.

## UX Flow

1. User sees character with strokes hidden (optional outline via Kaku's `showOutline`)
2. User draws a stroke on the canvas
3. Evaluation runs on stroke completion (pointerup)
4. Accept (score >= threshold): morph user stroke into correct position, advance Kaku to next stroke
5. Reject: fire onReject callback, show animated hint (draw animation in `hintColor` showing correct direction)
6. All strokes complete: fire onComplete callback with average score

## Hints

On rejection, the rendered stroke is animated with the draw effect to show the correct direction:
- Stroke color temporarily changes to `hintColor` (default: `#c44`)
- Draw animation runs for `hintDuration` seconds (default: 0.6)
- Brief hold (300ms) then stroke is hidden and color restored
- Uses Kaku's `getRenderedStrokes()` for calligraphic shapes (not canvas polylines)

## showGuide (deprecated)

`showGuide` defaults to `false` as of 1.3.0 (was `true` in earlier versions). The option is deprecated — use Kaku's `showOutline` instead. `showGuide: true` renders a secondary faint SVG guide below the Kaku SVG; `showOutline` renders the outline directly inside the Kaku SVG.

## Testing

Vitest + jsdom. Key considerations:
- Canvas 2D context is mocked in jsdom (getContext returns a basic mock)
- StrokeEvaluator is pure math — easy to unit test with synthetic points
- StrokeInput needs pointer event simulation (pointerdown/pointermove/pointerup)
- Mock Kaku object in tests must include `getRenderedStrokes()` returning mock RenderedStroke objects with `width="200" height="200"` on the SVG returned by `getSvg()` (needed for refresh() size validation)
- Use `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync()` for hint/morph timing
- `requestAnimationFrame` callbacks need manual flushing via `flushRaf()` (completes in one shot) or `flushRafOneShot(time)` (fires exactly one batch, use two calls with different times to cover intermediate animation frames)
- Coverage: 100% statements/branches/functions/lines on `kaku-ren.ts`

## Dependencies

- **Runtime**: `@kaspars/kaku` (peer dependency)
- **Dev**: TypeScript, Vite, Vitest, jsdom
