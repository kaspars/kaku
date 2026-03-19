# Kaku Ren (画練)

A stroke practice library for building Japanese and Chinese character study tools. Captures user drawing input on a canvas overlay and evaluates stroke accuracy against expected strokes from [@kaspars/kaku](https://www.npmjs.com/package/@kaspars/kaku).

The name comes from the Japanese 画練 — 画 (*kaku*, stroke) combined with 練 (*ren*, practice). Where [Kaku](https://www.npmjs.com/package/@kaspars/kaku) animates strokes, Kaku Ren lets you practice writing them.

**[Live demo](https://kaspars.github.io/kaku/#practice)**

## Installation

```bash
npm install @kaspars/kaku-ren @kaspars/kaku
```

## Overview

Kaku Ren adds interactive stroke practice on top of Kaku's animation engine:

1. Displays a canvas overlay on top of the Kaku SVG
2. Captures mouse/touch/pointer input as the user draws strokes
3. Evaluates each stroke against the expected path (shape, length, direction)
4. Morphs accepted strokes into the correct form
5. Shows animated hints on incorrect attempts (draw animation in hint color)

## Quick Start

```typescript
import { Kaku, KanjiVGProvider } from '@kaspars/kaku';
import { KakuRen } from '@kaspars/kaku-ren';

const provider = new KanjiVGProvider({
  basePath: 'https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji'
});

const container = document.getElementById('canvas');

// Pass strokeEffect: 'none' so Kaku doesn't re-animate strokes that
// KakuRen has already morphed into place.
const kaku = new Kaku({
  provider,
  container,
  size: 200,
  showOutline: true,
  animation: { autoplay: false, strokeEffect: 'none', strokeDuration: 0 },
});

// KakuRen can be constructed before or after kaku.load() — either order works.
const ren = new KakuRen({
  kaku,
  container,
  size: 200,
  strokeColor: '#333',
  hintColor: '#c44',
  onAccept(index, result) {
    console.log(`Stroke ${index + 1} accepted (${Math.round(result.score * 100)}%)`);
  },
  onReject(index, result) {
    console.log(`Stroke ${index + 1} rejected: ${result.rejection}`);
  },
  onComplete(averageScore) {
    console.log(`Done! Average score: ${Math.round(averageScore * 100)}%`);
  },
});

await kaku.load('漢');
ren.refresh(); // must be called after every kaku.load()
```

Works with both KanjiVG and AnimCJK providers — pass the appropriate Kaku instance.

## API

### Constructor Options

```typescript
interface KakuRenOptions {
  kaku: Kaku;                // Kaku instance (required)
  container: HTMLElement;    // Container element (required)
  size?: number;             // Canvas size in CSS pixels (default: 200)
  strokeColor?: string;      // Drawing stroke color (default: '#333')
  strokeWidth?: number;      // Drawing stroke width (auto-computed if omitted)
  hintColor?: string;        // Hint stroke color on rejection (default: '#c44')
  hintDuration?: number;     // Hint draw animation duration in seconds (default: 0.6)
  morphDuration?: number;    // Morph animation duration in ms (default: 80)
  evaluation?: EvaluatorOptions;  // Evaluation tuning
  onAccept?: (index: number, result: EvaluationResult) => void;
  onReject?: (index: number, result: EvaluationResult) => void;
  onComplete?: (averageScore: number) => void;
}
```

> **Important:** The `size` passed to `KakuRen` must match the `size` passed to `Kaku`. `refresh()` validates this and throws a descriptive error if they differ.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `currentStroke` | `number` | Current stroke index |
| `totalStrokes` | `number` | Total number of strokes |
| `averageScore` | `number` | Average score across all strokes |
| `allScores` | `readonly number[]` | All scores so far |
| `enabled` | `boolean` | Enable/disable drawing input |
| `guide` | `boolean` | Show/hide the deprecated guide overlay |

### Methods

| Method | Description |
|--------|-------------|
| `refresh(): void` | Sync overlay after `kaku.load()` — call this every time a new character is loaded |
| `reset(): void` | Reset practice state (scores and stroke position) without reloading |
| `playHints(): Promise<void>` | Play all stroke hints in sequence (debug/demo utility) |
| `dispose(): void` | Clean up resources |

### EvaluationResult

```typescript
interface EvaluationResult {
  accepted: boolean;
  score: number;             // 0-1, higher is better
  rejection?: 'too-short' | 'wrong-direction' | 'low-score';
}
```

## Credits

Stroke data is provided by [KanjiVG](http://kanjivg.tagaini.net/) (CC BY-SA 3.0) and [AnimCJK](https://github.com/parsimonhi/animCJK) (Arphic PL / LGPL). See the [@kaspars/kaku README](https://www.npmjs.com/package/@kaspars/kaku) for details.

## License

MIT
