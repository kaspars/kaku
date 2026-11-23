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
  size: 200,
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

const kaku = new Kaku({
  provider,
  container: document.getElementById('canvas'),
  size: 200,
  // Factory form — Kaku passes its own container and sizing to the renderer,
  // so they are declared once.
  renderer: (options) => new AnimCJKRenderer(options),
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
  container?: HTMLElement;     // Container element (required unless `renderer`
                               //   is a pre-built instance holding its own)
  renderer?: Renderer | RendererFactory;  // Custom renderer (default: SvgRenderer)
  size?: number;               // SVG size in pixels (default: 200)
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

#### Custom Renderers

`renderer` accepts either form:

```typescript
// Factory (preferred) — receives { container, size, width, height } from Kaku
renderer: (options) => new AnimCJKRenderer(options)

// Pre-built instance — owns its own container and dimensions
renderer: new AnimCJKRenderer({ container, size: 200 })
```

With a pre-built instance, Kaku's own `container`/`size`/`width`/`height` cannot
be applied to it and are ignored — passing both risks them disagreeing silently
(`size: 300` on Kaku with a renderer built at 200 renders at 200). Kaku warns
when you do this. The factory form takes the values from Kaku, so they are
declared once.

`container` is required except when `renderer` is a pre-built instance.

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
| `setShowOutline(value: boolean): void` | Toggle the outline overlay on the current character without a full reload. Resets animation state; call `kakuRen.refresh()` afterwards if using KakuRen. |
| `on(event, handler): () => void` | Subscribe to events, returns unsubscribe function |
| `getSvg(): SVGSVGElement` | Get the SVG element |
| `getCharacterData(): CharacterData \| null` | Get loaded character data |
| `getRenderedStrokes(): RenderedStroke[]` | Get rendered stroke objects for external control |
| `dispose(): void` | Clean up resources |

#### Manual stepping

`nextStroke()` and `previousStroke()` work while an animation is playing, but
they interrupt it:

- `nextStroke()` pauses, snaps the in-progress stroke to fully drawn, and then
  animates the following one.
- `previousStroke()` pauses and hides the in-progress stroke. That cancellation
  *is* the step back, so the stroke index stays put; call it again to step back
  further.
- `pause()` stops the sequence but does not freeze a stroke that is already
  transitioning — that stroke finishes drawing, and its `strokeComplete` event
  does not fire.

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

Renders stroke order diagrams as a series of static SVGs, showing cumulative stroke progress. Works with both KanjiVG and AnimCJK providers — AnimCJK diagrams render calligraphic shape outlines automatically.

```typescript
import { KakuDiagram, KanjiVGProvider } from '@kaspars/kaku';

const provider = new KanjiVGProvider({ basePath: '/kanjivg' });

const diagram = new KakuDiagram({
  provider,  // Works with any provider: KanjiVGProvider, AnimCJKProvider, MoeProvider…
  container: document.getElementById('diagram'),
  size: 80,
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
  size?: number;               // Per-SVG size in pixels (default: 109)
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

Uses the default `SvgRenderer`. Files are named by hex codepoint (`05b57.svg`) with a 109x109 viewBox. Character data is cached in memory — repeated `load()` calls for the same character return instantly without a network request.

#### AnimCJKProvider

Data provider for [AnimCJK](https://github.com/parsimonhi/animCJK) stroke data. Covers Japanese, Chinese (simplified and traditional), and Korean.

```typescript
const provider = new AnimCJKProvider({
  basePath: 'https://raw.githubusercontent.com/parsimonhi/animCJK/master',
  language: 'ja',     // 'ja' | 'zh-Hans' | 'zh-Hant' | 'ko'
  fetch: customFetch   // Optional custom fetch function
});
```

Requires `AnimCJKRenderer` to display calligraphic stroke shapes. Files are named by decimal codepoint (`23383.svg`) with a 1024x1024 viewBox. Japanese falls back from `svgsJa/` to `svgsJaKana/` for kana characters. Character data is cached in memory after the first fetch.

#### MoeProvider

Data provider for the Taiwan Ministry of Education's standard forms and stroke order (常用國字標準字體筆順學習網), as JSON from [g0v/zh-stroke-data](https://github.com/g0v/zh-stroke-data). Covers about 4,800 traditional characters.

```typescript
const provider = new MoeProvider({
  basePath: '/strokes/moe',  // Required: your copy of zh-stroke-data's json/ directory
  dropDuplicates: true,      // Optional (default true): drop strokes the data repeats
  fetch: customFetch         // Optional custom fetch function
});
```

The data is **not open**: it is © the Ministry of Education (Taiwan), for non-commercial educational use, so there is no default URL; host your own copy and check the terms suit your use. Files are named by lowercase hex codepoint (`52fb.json`). The provider scales the data's 2150 grid to a 1024 viewBox and builds an SVG in AnimCJK's layout, so it uses `AnimCJKRenderer`, and KakuRen scores against the stroke centre lines. A few characters in the scraped data repeat a stroke (年, 回, 寓; 懂 twice over); they are dropped unless `dropDuplicates` is false. Three tracks that jump back past the stroke's end (刃, 妒, 刈) are cut at the jump. See [docs/moe.md](../../docs/moe.md).

#### FallbackProvider

Asks providers in turn and answers from the first that has the character; `CharacterData.source` names the one that did.

```typescript
const provider = new FallbackProvider([
  new MoeProvider({ basePath: '/strokes/moe' }),
  new AnimCJKProvider({ basePath: '/strokes/animcjk', language: 'zh-Hant' }),
]);
```

Kaku draws every character with the one renderer it was given, so the providers must suit it: `MoeProvider` and `AnimCJKProvider` both suit `AnimCJKRenderer`, while `KanjiVGProvider` needs `SvgRenderer`.

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

`getCharacter` returns a result object rather than throwing:

```typescript
type ProviderResult<T> =
  | { success: true; data: T }
  | { success: false; error: Error };
```

`Kaku.load()` rethrows the `error` from a failed result, so callers can use
plain `try`/`catch`.

## Custom Renderers

Pass any `Renderer` implementation as the `renderer` option. It receives the
`CharacterData` and must return one `RenderedStroke` per stroke — the animator
drives those objects and never touches the DOM itself.

```typescript
interface Renderer {
  render(data: CharacterData, options?: RenderOptions): RenderedStroke[];
  getSvg(): SVGSVGElement;
  clear(): void;
  dispose(): void;
}

interface RenderedStroke {
  element: SVGPathElement;
  length: number;
  stroke: Stroke;
  setProgress(progress: number): void;      // 0 = hidden, 1 = fully drawn
  setTransition(duration: number, easing?: string): void;
  clearTransition(): void;
  setOpacity(opacity: number): void;        // used by the 'fade' effect
  setOpacityTransition(duration: number, easing?: string): void;
  clearOpacityTransition(): void;
}
```

## Lower-level Exports

The building blocks are exported too, for custom renderers and tooling:

| Export | Description |
|--------|-------------|
| `StrokeAnimator` | The animator on its own — drive any `RenderedStroke[]` without `Kaku` |
| `SvgRenderer`, `AnimCJKRenderer` | The bundled renderers |
| `createStrokePath(stroke, options)` | Build a `RenderedStroke` from stroke data |
| `createSvg`, `createPath`, `createLine`, `createGroup`, `createSvgElement` | SVG element helpers |
| `toHex(char, padLength?)` | Character to zero-padded lowercase hex code point |
| `getCodePoints(str)` | Code points of a string, surrogate-pair aware |

## Browser Support

Requires ES2020+ (modern browsers). Uses CSS transitions, SVG, and async/await.

## Credits

Stroke data is provided by these open-source projects:

- **[KanjiVG](http://kanjivg.tagaini.net/)** by Ulrich Apel — Japanese kanji and kana stroke data. Licensed under [Creative Commons Attribution-Share Alike 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
- **[AnimCJK](https://github.com/parsimonhi/animCJK)** by parsimonhi — Japanese, Chinese, and Korean stroke data with calligraphic outlines. Licensed under [Arphic Public License](https://github.com/ArtifexSoftware/urw-base35-fonts/blob/master/LICENSE) and [LGPL](https://www.gnu.org/licenses/lgpl-3.0.html).

`MoeProvider` reads data that is not bundled or linked by default: the Taiwan Ministry of Education's [國字標準字體筆順學習網](https://stroke-order.learningweb.moe.edu.tw/), © Ministry of Education, for non-commercial educational use, as converted by [g0v/zh-stroke-data](https://github.com/g0v/zh-stroke-data).

## License

MIT
