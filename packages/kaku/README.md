# Kaku (画)

A TypeScript library for CJK character stroke animation, suitable for building Japanese and Chinese character study tools. For interactive stroke practice, see [@kaspars/kaku-ren](https://www.npmjs.com/package/@kaspars/kaku-ren).

Named after 画 (*kaku* in Japanese) — the kanji for "stroke," as in 画数 (*kakusū*, stroke count). It carries the dual meaning of drawing and the individual strokes that compose CJK characters.

**[Live demo](https://kaspars.github.io/kaku/#animation)**

## Installation

```bash
npm install @kaspars/kaku
```

## Quick Start

### With KanjiVG (Japanese kanji and kana)

```typescript
import { Kaku, KanjiVGProvider } from '@kaspars/kaku';

const provider = new KanjiVGProvider({
  basePath: 'https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji'
});

const kaku = new Kaku({
  provider,
  container: document.getElementById('canvas'),
  width: 200,
  height: 200,
  strokeColor: '#000',
  showGrid: true,
  animation: { strokeDuration: 0.5, loop: false }
});

await kaku.load('漢');
kaku.play();
```

### With AnimCJK (Japanese, Chinese, Korean)

AnimCJK requires its own renderer to display calligraphic stroke shapes:

```typescript
import { Kaku, AnimCJKProvider, AnimCJKRenderer } from '@kaspars/kaku';

const provider = new AnimCJKProvider({
  basePath: 'https://raw.githubusercontent.com/parsimonhi/animCJK/master',
  language: 'ja'  // 'ja' | 'zh-Hans' | 'zh-Hant' | 'ko'
});

const container = document.getElementById('canvas');

const kaku = new Kaku({
  provider,
  renderer: new AnimCJKRenderer({ container, width: 200, height: 200 }),
  container,
  width: 200,
  height: 200,
  showOutline: true,
  animation: { strokeDuration: 0.5 }
});

await kaku.load('漢');
kaku.play();
```

## API

### Kaku

Main class that orchestrates character loading, rendering, and animation.

#### Constructor Options

```typescript
interface KakuOptions {
  provider: DataProvider;      // Data provider (required)
  container: HTMLElement;      // Container element (required)
  renderer?: Renderer;         // Custom renderer (default: SvgRenderer)
  width?: number | string;     // SVG width (default: 200)
  height?: number | string;    // SVG height (default: 200)
  strokeColor?: string;        // Stroke color (default: '#000')
  strokeWidth?: number;        // Stroke width (default: 3)
  showGrid?: boolean;          // Show grid lines (default: false)
  gridColor?: string;          // Grid line color (default: '#ccc')
  showOutline?: boolean;       // Show faint character outline (default: false)
  outlineColor?: string;       // Outline color (default: '#ccc')
  animation?: AnimatorOptions; // Animation options
}

interface AnimatorOptions {
  strokeDuration?: number;  // Seconds per stroke (default: 0.5)
  easing?: string;          // CSS easing (default: 'ease')
  loop?: boolean;           // Loop animation (default: false)
  loopDelay?: number;       // Delay before loop restart in seconds (default: 1)
  autoplay?: boolean;       // Auto-play on load (default: false)
  strokeEffect?: 'draw' | 'fade' | 'none';  // Animation effect (default: 'draw')
}
```

#### Stroke Effects

- **`draw`** (default): Stroke is progressively drawn using stroke-dashoffset
- **`fade`**: Stroke fades in using opacity transition
- **`none`**: Stroke appears instantly (still respects strokeDuration as delay between strokes)

#### Methods

| Method | Description |
|--------|-------------|
| `load(char: string): Promise<void>` | Load and render a character |
| `play(): void` | Start or resume animation |
| `pause(): void` | Pause animation |
| `reset(): void` | Reset animation to beginning |
| `nextStroke(): Promise<void>` | Animate next stroke (manual mode) |
| `previousStroke(): void` | Go back one stroke (manual mode) |
| `on(event, handler): () => void` | Subscribe to events, returns unsubscribe function |
| `getSvg(): SVGSVGElement` | Get the SVG element |
| `getCharacterData(): CharacterData \| null` | Get loaded character data |
| `getRenderedStrokes(): RenderedStroke[]` | Get rendered stroke objects for external control |
| `dispose(): void` | Clean up resources |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `state` | `AnimationState` | Current state: 'idle', 'playing', 'paused', 'completed' |
| `currentStroke` | `number` | Current stroke index |
| `totalStrokes` | `number` | Total number of strokes |
| `character` | `string | null` | Currently loaded character |

#### Events

```typescript
kaku.on('start', () => console.log('Animation started'));
kaku.on('strokeStart', (e) => console.log(`Stroke ${e.strokeIndex} started`));
kaku.on('strokeComplete', (e) => console.log(`Stroke ${e.strokeIndex} complete`));
kaku.on('complete', () => console.log('Animation complete'));
kaku.on('pause', () => console.log('Paused'));
kaku.on('resume', () => console.log('Resumed'));
kaku.on('reset', () => console.log('Reset'));
```

### KakuDiagram

Renders stroke order diagrams as a series of static SVGs, showing cumulative stroke progress.

```typescript
import { KakuDiagram, KanjiVGProvider } from '@kaspars/kaku';

const provider = new KanjiVGProvider({ basePath: '/kanjivg' });

const diagram = new KakuDiagram({
  provider,
  container: document.getElementById('diagram'),
  width: 80,
  height: 80,
  strokeColor: '#333',
  strokeWidth: 3,
  showGrid: true,
});

await diagram.load('漢');
```

#### Constructor Options

```typescript
interface KakuDiagramOptions {
  provider: DataProvider;      // Data provider (required)
  container: HTMLElement;      // Container element (required)
  width?: number | string;     // Per-SVG width (default: 109)
  height?: number | string;    // Per-SVG height (default: 109)
  strokeColor?: string;        // Stroke color (default: '#000')
  strokeWidth?: number;        // Stroke width (default: 3)
  showGrid?: boolean;          // Show grid lines (default: false)
  gridColor?: string;          // Grid line color (default: '#ddd')
}
```

#### Methods

| Method | Description |
|--------|-------------|
| `load(char: string): Promise<void>` | Load and render stroke order diagram |
| `getSvgElements(): SVGSVGElement[]` | Get array of rendered SVG elements |
| `getCharacterData(): CharacterData \| null` | Get loaded character data |
| `clear(): void` | Remove all rendered SVGs |
| `dispose(): void` | Clean up resources |

### Providers

#### KanjiVGProvider

Data provider for [KanjiVG](http://kanjivg.tagaini.net/) stroke data. Covers Japanese kanji, hiragana, and katakana.

```typescript
const provider = new KanjiVGProvider({
  basePath: 'https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji',
  fetch: customFetch  // Optional custom fetch function
});
```

Uses the default `SvgRenderer`. Files are named by hex codepoint (`05b57.svg`) with a 109x109 viewBox.

#### AnimCJKProvider

Data provider for [AnimCJK](https://github.com/parsimonhi/animCJK) stroke data. Covers Japanese, Chinese (simplified and traditional), and Korean.

```typescript
const provider = new AnimCJKProvider({
  basePath: 'https://raw.githubusercontent.com/parsimonhi/animCJK/master',
  language: 'ja',     // 'ja' | 'zh-Hans' | 'zh-Hant' | 'ko'
  fetch: customFetch   // Optional custom fetch function
});
```

Requires `AnimCJKRenderer` to display calligraphic stroke shapes. Files are named by decimal codepoint (`23383.svg`) with a 1024x1024 viewBox. Japanese falls back from `svgsJa/` to `svgsJaKana/` for kana characters.

### CharacterData

Normalized character data format returned by providers.

```typescript
interface CharacterData {
  character: string;
  codePoints: number[];
  viewBox: [number, number, number, number];
  strokes: Stroke[];
  source: string;
  rawSvg?: string;  // Present for AnimCJK (used by AnimCJKRenderer)
}

interface Stroke {
  pathData: string;
  metadata: {
    index: number;
    type?: string;
    sourceId?: string;
  };
}
```

## Custom Providers

Implement the `DataProvider` interface to support other data sources:

```typescript
interface DataProvider {
  readonly id: string;
  getCharacter(char: string): Promise<ProviderResult<CharacterData>>;
  canHandle(char: string): boolean;
}
```

## Browser Support

Requires ES2020+ (modern browsers). Uses CSS transitions, SVG, and async/await.

## License

MIT
