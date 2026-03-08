# AnimCJK Data Source

[AnimCJK](https://github.com/parsimonhi/animCJK) provides stroke order data for Japanese, Korean, and Chinese (simplified and traditional) characters. It is derived from the [MakeMeAHanzi](https://github.com/skishore/makemeahanzi) project and Arphic PL KaitiM fonts.

## Coverage

AnimCJK has significantly broader coverage than KanjiVG, especially for Chinese:

| Directory | Content | Count |
|-----------|---------|-------|
| `svgsJa` | Japanese kanji | ~5,450 |
| `svgsJaKana` | Hiragana and katakana | ~200 |
| `svgsJaSpecial` | Variant kanji forms | small |
| `svgsZhHans` | Simplified Chinese | ~7,700 |
| `svgsZhHant` | Traditional Chinese | ~1,000 |
| `svgsKo` | Korean hanja | ~535 |
| `svgsKoSpecial` | Variant hanja forms | small |

## File Format

Files are named by **decimal** codepoint: `23383.svg` for 字 (U+5B57 = 23383 in decimal). This differs from KanjiVG which uses hex.

### ViewBox

All SVGs use a `1024 x 1024` viewBox (compared to KanjiVG's `109 x 109`):

```xml
<svg id="z23383" class="acjk" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
```

### Structure

Each SVG contains three sections:

1. **Embedded CSS** — animation keyframes and styling
2. **Shape paths** — filled outlines defining each stroke's visible shape
3. **Stroke paths** — simplified polylines defining drawing direction (used with clip-path)

#### 1. Embedded CSS

```xml
<style>
@keyframes zk {
    to { stroke-dashoffset: 0; }
}
svg.acjk path[clip-path] {
    --t: 0.8s;
    animation: zk var(--t) linear forwards var(--d);
    stroke-dasharray: 3337;
    stroke-dashoffset: 3339;
    stroke-width: 128;
    stroke-linecap: round;
    fill: none;
    stroke: #000;
}
svg.acjk path[id] { fill: #ccc; }
</style>
```

The animation uses a wide stroke (`stroke-width: 128`) that sweeps along a simplified path, clipped to the stroke's outline shape. The `--d` custom property staggers stroke timing (1s, 2s, 3s...).

#### 2. Shape Paths (Stroke Outlines)

Each stroke's visible shape is defined as a filled closed path using cubic Bezier curves:

```xml
<path id="z23383d1" d="M467 101C487 114...467 101Z"/>
```

- **ID pattern**: `z{codepoint}d{n}` (e.g., `z23383d1` for stroke 1)
- **Path data**: Complex Bezier outlines (`M`, `C`, `Q`, `L`, `Z` commands)
- These paths are used as **clip regions** via `<clipPath>` / `<use>` references

#### 3. Stroke Paths (Direction Lines)

The animation paths are simplified polylines that define drawing direction:

```xml
<path style="--d:1s;" pathLength="3333" clip-path="url(#z23383c1)" d="M432 56L516 93L572 151"/>
```

- **Path data**: Simple `M`/`L` polylines (move-to and line-to only)
- **`clip-path`**: References the corresponding shape path
- **`pathLength="3333"`**: Normalized path length for consistent `stroke-dasharray` animation
- **`--d`**: Animation delay (determines stroke order)

The visual effect: a thick black stroke sweeps along the polyline, but only the portion inside the clip region is visible, creating the appearance of the stroke being drawn in its correct calligraphic shape.

### Multi-Part Strokes

Some strokes span multiple clip regions and are represented with lettered suffixes:

```xml
<path id="z12354d3a" d="..."/>  <!-- first part of stroke 3 -->
<path id="z12354d3b" d="..."/>  <!-- second part of stroke 3 -->
```

Both parts share the same `--d` delay value and animate simultaneously. The stroke direction paths for multi-part strokes also share the same polyline data (or similar), each clipped to its respective region. This occurs when a single brush stroke covers a complex shape that can't be represented by a single filled outline.

Example: hiragana あ (U+3042) has stroke 3 split into parts `d3a` and `d3b`.

### Comparison: Shape vs Stroke Path for 字

| Stroke | Shape path (outline) | Stroke path (direction) |
|--------|---------------------|------------------------|
| 1 | `M467 101C487 114...Z` (complex Bezier) | `M432 56L516 93L572 151` (3 points) |
| 6 | `M559 607C666 598...Z` (complex Bezier) | `M130 613L191 631L830 563L917 583` (4 points) |

The shape paths contain the visual detail; the stroke paths contain the directional skeleton.

## Dictionary Files

AnimCJK includes JSON-lines dictionary files with metadata per character:

```json
{"character":"字","set":["g1"],"definition":"letter, character; word",
 "kun":["あざ","あざな"],"on":["ジ"],"radical":"子",
 "decomposition":"⿱宀子","acjk":"字⿱宀3子.3"}
```

Fields include: grade set, definition, kun/on readings (Japanese), radical, and decomposition. These are supplementary and not required for stroke animation.

## Integration with Kaku

### Key Differences from KanjiVG

| Aspect | KanjiVG | AnimCJK |
|--------|---------|---------|
| ViewBox | 109 x 109 | 1024 x 1024 |
| File naming | Hex codepoint, 5-digit padded (`05b57.svg`) | Decimal codepoint (`23383.svg`) |
| Stroke representation | Single Bezier path per stroke | Two paths: shape outline + direction polyline |
| Animation technique | `stroke-dashoffset` on the stroke path | `stroke-dashoffset` on polyline, clipped to shape |
| Path complexity | Moderate Bezier curves | Complex Bezier outlines + simple polylines |
| Multi-part strokes | Not applicable | Letter suffixes (`d3a`, `d3b`) |
| Language coverage | Japanese only (kanji + kana) | Japanese, Chinese (simplified + traditional), Korean |
| Stroke type metadata | `kvg:type` attribute | Not provided |
| Radical decomposition | Nested `<g>` groups with metadata | Flat structure (decomposition in dictionary files) |

### Provider Design Considerations

An `AnimCJKProvider` would need to:

1. **Convert codepoints to decimal** for file URLs (not hex like KanjiVG)
2. **Select the correct subdirectory** based on the target language:
   - Japanese: `svgsJa/` (kanji) + `svgsJaKana/` (kana)
   - Simplified Chinese: `svgsZhHans/`
   - Traditional Chinese: `svgsZhHant/`
   - Korean: `svgsKo/`
3. **Return the raw SVG content** for Kaku to embed directly
4. **Parse the direction polylines** (paths with `clip-path` attribute) for stroke metadata
5. **Group multi-part strokes** by base number (e.g., `d3a` + `d3b` = stroke 3) — these share the same `--d` delay value

### Animation Approach: Wrapping Native SVGs

AnimCJK SVGs are self-animating — they contain embedded CSS keyframes that animate strokes via `stroke-dashoffset` on clipped polylines. Rather than reimplementing this animation, Kaku acts as a thin wrapper:

**Animated playback**: Embed the SVG as-is. The embedded CSS handles the animation automatically. Kaku can control timing by overriding the `--t` (duration) and `--d` (delay) custom properties.

**Step-by-step mode**: AnimCJK's own [card demo](https://github.com/parsimonhi/animCJK/blob/master/samples/card.html) demonstrates this approach:

1. Strip the embedded `<style>` block from the SVG
2. Apply external CSS that starts all stroke paths as transparent:
   ```css
   svg.acjk path[id]      { fill: #ccc; }         /* shape outlines: grey */
   svg.acjk path:not([id]) { stroke: transparent; } /* stroke paths: hidden */
   ```
3. Toggle visibility by adding a `visible` class to individual stroke paths:
   ```css
   svg.acjk path.visible:not([id]) { stroke: #000; }
   ```
4. Track a `lastShown` counter — strokes with index < lastShown get `class="visible"`

This enables `nextStroke()` / `previousStroke()` / `reset()` with zero animation logic — just CSS class toggling. The stroke paths already have `clip-path` set, so making a stroke visible instantly reveals its full calligraphic shape through the clip region.

**Hybrid approach**: For animated step-by-step (where each stroke draws progressively), selectively enable the CSS animation on individual stroke paths while keeping others either hidden or fully revealed.

### Practice (kaku-ren) Considerations

For stroke evaluation in kaku-ren, the **direction polylines** are the relevant paths:

- They define the natural writing direction (start point, end point, trajectory)
- They are simple `M`/`L` polylines, so point sampling is trivial (no Bezier math needed)
- The evaluation logic (resample, compare, check direction) works the same way
- The `1024 x 1024` viewBox just changes the scale factor: `scaleFactor = canvasWidth / 1024`

Multi-part strokes should be evaluated as a single stroke by concatenating the direction polylines.

## License

AnimCJK uses a dual license depending on the data source:

- **Kanji/Hanzi SVGs** (derived from Arphic fonts): [Arphic Public License](https://ftp.gnu.org/non-gnu/chinese-fonts-truetype/LICENSE)
- **Kana SVGs**: [GNU Lesser General Public License v3](https://www.gnu.org/licenses/lgpl-3.0.html) (LGPL-3.0)

Applications using AnimCJK data should include appropriate attribution and comply with the relevant license terms.
