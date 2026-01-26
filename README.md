# Kaku

A TypeScript library for CJK character stroke animation with pluggable data adapters.

## Installation

```bash
npm install kaku
```

## Quick Start

```typescript
import { Kaku, KanjiVGProvider } from 'kaku';

// Create provider pointing to KanjiVG SVG files
const provider = new KanjiVGProvider({
  basePath: '/path/to/kanjivg'
});

// Create Kaku instance
const kaku = new Kaku({
  provider,
  container: document.getElementById('canvas'),
  width: 200,
  height: 200,
  strokeColor: '#000',
  strokeWidth: 3,
  showGrid: true,
  animation: {
    strokeDuration: 0.5,
    loop: false
  }
});

// Load and animate a character
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
  width?: number | string;     // SVG width (default: 200)
  height?: number | string;    // SVG height (default: 200)
  strokeColor?: string;        // Stroke color (default: '#000')
  strokeWidth?: number;        // Stroke width (default: 3)
  showGrid?: boolean;          // Show grid lines (default: false)
  gridColor?: string;          // Grid line color (default: '#ccc')
  animation?: AnimatorOptions; // Animation options
}

interface AnimatorOptions {
  strokeDuration?: number;  // Seconds per stroke (default: 0.5)
  easing?: string;          // CSS easing (default: 'ease')
  loop?: boolean;           // Loop animation (default: false)
  loopDelay?: number;       // Delay before loop restart in seconds (default: 0)
  autoplay?: boolean;       // Auto-play on load (default: false)
}
```

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
| `getCharacterData(): CharacterData | null` | Get loaded character data |
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

### KanjiVGProvider

Data provider for KanjiVG stroke data.

```typescript
const provider = new KanjiVGProvider({
  basePath: 'https://example.com/kanjivg',  // Base URL to SVG files
  fetch: customFetch  // Optional custom fetch function
});

// Check if provider can handle a character
provider.canHandle('漢');  // true
provider.canHandle('A');   // false

// Fetch character data
const result = await provider.getCharacter('漢');
if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error);
}
```

### CharacterData

Normalized character data format returned by providers.

```typescript
interface CharacterData {
  character: string;                        // The character
  codePoints: number[];                     // Unicode code points
  viewBox: [number, number, number, number]; // SVG viewBox
  strokes: Stroke[];                        // Stroke data in order
  source: string;                           // Provider ID
}

interface Stroke {
  pathData: string;           // SVG path "d" attribute
  metadata: {
    index: number;            // Stroke index (0-based)
    type?: string;            // Stroke type (e.g., "㇐")
    sourceId?: string;        // Original source ID
  };
}
```

## Manual Mode

For step-by-step stroke practice:

```typescript
const kaku = new Kaku({
  provider,
  container,
  animation: { strokeDuration: 0.5 }
});

await kaku.load('字');

// Advance one stroke at a time
await kaku.nextStroke();  // Animates stroke 1
await kaku.nextStroke();  // Animates stroke 2

// Go back
kaku.previousStroke();    // Hides stroke 2

// Reset all
kaku.reset();
```

## Custom Providers

Implement the `DataProvider` interface to support other data sources:

```typescript
interface DataProvider {
  readonly id: string;
  getCharacter(char: string): Promise<ProviderResult<CharacterData>>;
  canHandle(char: string): boolean;
}

type ProviderResult<T> =
  | { success: true; data: T }
  | { success: false; error: Error };
```

Example:

```typescript
class MyProvider implements DataProvider {
  readonly id = 'my-provider';

  canHandle(char: string): boolean {
    // Return true if this provider can handle the character
    return true;
  }

  async getCharacter(char: string): Promise<ProviderResult<CharacterData>> {
    try {
      const data = await fetchMyData(char);
      return { success: true, data };
    } catch (error) {
      return { success: false, error };
    }
  }
}
```

## Browser Support

Requires ES2020+ (modern browsers). Uses:
- CSS transitions for animation
- SVG for rendering
- Promises/async-await

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build
npm run build
```

## License

MIT
