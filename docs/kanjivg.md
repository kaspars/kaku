# KanjiVG Data Source

[KanjiVG](http://kanjivg.tagaini.net/) provides stroke order data for Japanese kanji, hiragana, and katakana.

## Coverage

- CJK Unified Ideographs (U+4E00-U+9FFF) — common kanji
- CJK Extension A (U+3400-U+4DBF)
- Hiragana (U+3040-U+309F)
- Katakana (U+30A0-U+30FF)

## File Format

Files are named by zero-padded 5-digit hex codepoint: `05b57.svg` for 字 (U+5B57).

### ViewBox

All SVGs use a `109 x 109` viewBox:

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="109" height="109" viewBox="0 0 109 109">
```

### Structure

Each SVG contains two top-level groups:

1. **`StrokePaths`** — the actual stroke geometry
2. **`StrokeNumbers`** — positioned text labels (1, 2, 3...) for reference

The `StrokePaths` group nests `<g>` elements that reflect the character's radical decomposition. For example, 字 is decomposed as:

```
字
├── 宀 (top)
│   ├── s1: ㇑a (vertical tick)
│   └── 冖
│       ├── s2: ㇔ (left diagonal)
│       └── s3: ㇖b (horizontal sweep)
└── 子 (bottom)
    ├── s4: ㇖ (horizontal + turn)
    ├── s5: ㇁ (vertical curve)
    └── s6: ㇐ (horizontal)
```

### Stroke Paths

Each stroke is a `<path>` element with:

- **`id`**: `kvg:{hex}-s{n}` (e.g., `kvg:05b57-s1`)
- **`d`**: Full SVG path data using cubic Bezier curves (`c`, `C` commands)
- **`kvg:type`**: Stroke type label (e.g., `㇐` for horizontal, `㇑` for vertical)

The path data describes the actual calligraphic shape of the stroke using Bezier curves. This is the path that gets animated and also serves as the evaluation reference in kaku-ren.

Example (stroke 1 of 字):

```xml
<path id="kvg:05b57-s1" kvg:type="㇑a"
  d="M52.73,9.5c1.01,1.01,1.75,2.25,1.75,3.76c0,3.53-0.09,5.73-0.1,8.95"/>
```

### Metadata Attributes

The nested `<g>` groups carry decomposition metadata via `kvg:*` attributes:

| Attribute | Description |
|-----------|-------------|
| `kvg:element` | The character or radical this group represents |
| `kvg:position` | Spatial position: `top`, `bottom`, `left`, `right`, etc. |
| `kvg:radical` | Radical classification: `nelson`, `tradit`, etc. |
| `kvg:phon` | Phonetic component |
| `kvg:type` | Stroke type on `<path>` elements |

## Integration with Kaku

### Provider: `KanjiVGProvider`

The existing provider (`packages/kaku/src/providers/kanjivg-provider.ts`) handles:

1. Building the URL from character codepoint (hex, 5-digit padded)
2. Fetching and parsing the SVG
3. Extracting stroke paths by matching `id` pattern `/^kvg:[0-9a-f]+-s\d+$/`
4. Sorting strokes by stroke number
5. Returning normalized `CharacterData`

### Animation

Kaku animates KanjiVG strokes using CSS `stroke-dashoffset` transitions on the original Bezier path data. Since KanjiVG paths describe the actual stroke shape, the `draw` effect reveals the stroke progressively from start to end.

### Practice (kaku-ren)

Kaku Ren uses the Bezier stroke paths for evaluation:

1. Sample N equidistant points along the path using `SVGPathElement.getTotalLength()` and `getPointAtLength()`
2. Resample the user's drawn points to the same count
3. Convert between canvas pixels and viewBox coordinates using `scaleFactor = canvasWidth / 109`
4. Compare point-by-point with normalized Euclidean distance

The Bezier curves provide smooth, accurate sampling for stroke evaluation. Short strokes receive a scoring boost since they are harder to match precisely.

## License

Creative Commons Attribution-Share Alike 3.0 (CC BY-SA 3.0).

Attribution must include a link to [kanjivg.tagaini.net](http://kanjivg.tagaini.net).
