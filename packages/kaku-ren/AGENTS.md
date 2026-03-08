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

## Evaluation Algorithm

1. Resample both expected and user strokes to N equidistant points (N=50)
2. Convert user points from canvas coords to viewBox space (109x109 for KanjiVG, 1024x1024 for AnimCJK)
3. Compute average Euclidean distance between corresponding points
4. Normalize by expected stroke length (scale-invariant)
5. Reject if user stroke length < 2/3 of expected
6. Apply length-based boost for short strokes (< 20 units)
7. Score = 1 - normalizedDistance / (threshold * boost), clamped to [0, 1]

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

## Testing

Vitest + jsdom. Key considerations:
- Canvas 2D context is mocked in jsdom (getContext returns a basic mock)
- StrokeEvaluator is pure math — easy to unit test with synthetic points
- StrokeInput needs pointer event simulation (pointerdown/pointermove/pointerup)
- Mock Kaku object in tests must include `getRenderedStrokes()` returning mock RenderedStroke objects
- Use `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync()` for hint/morph timing
- `requestAnimationFrame` callbacks need manual flushing

## Dependencies

- **Runtime**: `@kaspars/kaku` (peer dependency)
- **Dev**: TypeScript, Vite, Vitest, jsdom
