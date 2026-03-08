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

### Provider: `AnimCJKProvider`

The provider (`packages/kaku/src/providers/animcjk-provider.ts`) handles:

1. **Decimal codepoint file URLs** (not hex like KanjiVG)
2. **Language-based subdirectory selection**:
   - Japanese: `svgsJa/` (kanji), falls back to `svgsJaKana/` (kana)
   - Simplified Chinese: `svgsZhHans/`
   - Traditional Chinese: `svgsZhHant/`
   - Korean: `svgsKo/`
3. **Storing the raw SVG** on `CharacterData.rawSvg` for the renderer
4. **Parsing direction polylines** (paths with `clip-path` attribute) for stroke metadata
5. **Grouping multi-part strokes** by `--d` CSS delay value (e.g., paths sharing `--d:3s` form one stroke)

### Renderer: `AnimCJKRenderer`

The renderer (`packages/kaku/src/renderer/animcjk-renderer.ts`) embeds the native AnimCJK SVG and controls strokes via JavaScript:

1. Parses `rawSvg` and strips the embedded `<style>` block
2. Injects control CSS:
   - Shape paths (`path[id]`): `fill: none` (or `fill: outlineColor` when `showOutline` is true)
   - Stroke paths (`path[clip-path]`): colored, stroke-width 128, hidden via `stroke-dashoffset`
3. Groups stroke paths by `--d` delay, creates `RenderedStroke` wrappers
4. Each `RenderedStroke` controls `stroke-dashoffset` for draw animation:
   - `setProgress(0)` = fully hidden (dashoffset = pathLength)
   - `setProgress(1)` = fully revealed (dashoffset = 0)
   - Multi-part strokes animate all parts together

This integrates with the existing `StrokeAnimator` — all three stroke effects (draw, fade, none) work with AnimCJK strokes.

### Practice (kaku-ren)

For stroke evaluation in kaku-ren, the **direction polylines** are used:

- They define the natural writing direction (start point, end point, trajectory)
- They are simple `M`/`L` polylines, so point sampling is trivial (no Bezier math needed)
- The evaluation logic (resample, compare, check direction) works identically to KanjiVG
- The `1024 x 1024` viewBox changes only the scale factor: `scaleFactor = canvasWidth / 1024`
- Multi-part strokes are evaluated as a single stroke (concatenated polylines)

For rejection hints, `getRenderedStrokes()` provides access to the calligraphic shapes — the hint animates the draw effect on the actual rendered stroke (not the raw polyline), showing the correct direction in the full calligraphic form.

## License

AnimCJK uses a dual license depending on the data source:

- **Kanji/Hanzi SVGs** (derived from Arphic fonts): [Arphic Public License](https://ftp.gnu.org/non-gnu/chinese-fonts-truetype/LICENSE)
- **Kana SVGs**: [GNU Lesser General Public License v3](https://www.gnu.org/licenses/lgpl-3.0.html) (LGPL-3.0)

Applications using AnimCJK data should include appropriate attribution and comply with the relevant license terms.
