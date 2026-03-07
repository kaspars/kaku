# Kaku Ren - Agent Context

## Overview

Stroke practice library that adds interactive drawing input and evaluation on top of Kaku's animation engine. Users draw strokes on a canvas overlay and receive feedback on accuracy.

## Architecture (Planned)

```
┌──────────────────────────────────────────────────┐
│                    KakuRen                         │
│              (Practice Orchestrator)               │
├──────────────────────────────────────────────────┤
│                                                    │
│  ┌──────────────┐  ┌──────────────┐               │
│  │  StrokeInput │  │   Kaku       │  (dependency) │
│  │ (canvas I/O) │  │ (animation)  │               │
│  └──────┬───────┘  └──────────────┘               │
│         │                                          │
│         ▼                                          │
│  ┌─────────────────┐                               │
│  │ StrokeEvaluator  │                               │
│  │ (score strokes)  │                               │
│  └─────────────────┘                               │
│                                                    │
└──────────────────────────────────────────────────┘
```

## Key Components (Planned)

| Component | Purpose |
|-----------|---------|
| `StrokeInput` | Canvas overlay, pointer event handling, point capture |
| `StrokeEvaluator` | Pure function: compares user points vs expected path, returns score |
| `KakuRen` | Orchestrator: ties input, evaluation, and Kaku animation together |

## Evaluation Algorithm

Ported from jikaku-mondai:

1. Resample both expected and user strokes to N equidistant points (N=50)
2. Convert user points from canvas coords to KanjiVG space (109x109)
3. Compute average Euclidean distance between corresponding points
4. Normalize by expected stroke length (scale-invariant)
5. Reject if user stroke length < 2/3 of expected
6. Apply length-based boost for short strokes (< 20 units)
7. Score = 1 - normalizedDistance / (threshold * boost), clamped to [0, 1]

### Direction checking (new in kaku-ren)

Compare stroke direction by checking proximity of start/end points to expected start/end vs reversed.

## UX Flow

1. User sees character with strokes hidden
2. User draws a stroke on the canvas
3. Evaluation runs on stroke completion (mouseup/touchend/pointerup)
4. Accept (score >= threshold): morph user stroke into correct stroke, advance
5. Reject (score < threshold): flash feedback, let user retry
6. After 3 failures: show hint animation
7. All strokes complete: fire completion callback

## Testing

Vitest + jsdom. Key considerations:
- Canvas API needs mocking in jsdom
- StrokeEvaluator is pure math — easy to unit test
- StrokeInput needs pointer event simulation

## Dependencies

- **Runtime**: `kaku` (peer/regular dependency)
- **Dev**: TypeScript, Vite, Vitest, jsdom
