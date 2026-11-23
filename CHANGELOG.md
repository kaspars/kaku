# Changelog

All notable changes to `@kaspars/kaku` and `@kaspars/kaku-ren` are documented
here. Both packages are versioned together.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

---

## [1.5.0] – 2026-11-23

### Added (`@kaspars/kaku`)
- `MoeProvider` — stroke data for the Taiwan Ministry of Education's
  standard forms and stroke order (常用國字標準字體筆順學習網), read from a
  copy of g0v/zh-stroke-data's JSON. `basePath` is required: the data is
  © the Ministry, for non-commercial educational use, and is neither
  bundled nor linked by default. The 2150 grid is scaled to a 1024 viewBox
  and an AnimCJK-layout SVG is built, so it renders with `AnimCJKRenderer`
  and KakuRen scores against the stroke centre lines. Strokes the scraped
  data repeats (13 characters, among them 年, 回 and 懂) are dropped unless
  `dropDuplicates: false`. See `docs/moe.md`.
- `FallbackProvider` — asks providers in turn and answers from the first
  that has the character, e.g. MOE with AnimCJK behind it.

### Changed (`@kaspars/kaku-ren`)
- No changes; released with kaku as always.

---

## [1.4.0] – 2026-11-23

### Added (`@kaspars/kaku`)
- `renderer` now accepts a factory — `(options) => new AnimCJKRenderer(options)`
  — which receives the `container`, `size`, `width` and `height` already given
  to `Kaku`, so they are declared once instead of on both objects. Exported as
  the `RendererFactory` and `RendererFactoryOptions` types.

### Fixed (`@kaspars/kaku`)
- The dashoffset and opacity transition channels on `RenderedStroke` are now
  independent. Both wrote the single `style.transition` property, so
  `setTransition()` and `setOpacityTransition()` overwrote each other and
  either `clear*` call wiped both. Affected `SvgRenderer` and
  `AnimCJKRenderer` alike.
- `container`, `size`, `width` and `height` are no longer silently ignored when
  a pre-built `renderer` instance is passed. Kaku now warns that the renderer
  owns its own, and points at the factory form. `container` is correspondingly
  optional when `renderer` is a pre-built instance, and `Kaku` throws when
  neither is supplied.

### Added (`@kaspars/kaku-ren`)
- `onStroke(attempt)` — called for every evaluated stroke, accepted or not,
  with the raw points in viewBox units, the time of each point since the
  stroke began, the expected length and the `EvaluationResult`. Meant for
  logging and replaying strokes. Exported as the `StrokeAttempt` type.
- `StrokeInput`'s `onStrokeEnd` receives the point times as a second argument.
- `EvaluatorOptions.shortStrokeFloor` (default 0.3) and
  `EvaluatorOptions.viewBoxSize` (default 109; `KakuRen` sets it from the
  loaded character).

### Fixed (`@kaspars/kaku-ren`)
- Short strokes were judged far more strictly than long ones on AnimCJK.
  The score normalised the distance by the stroke's own length, and the
  short-stroke boost used absolute thresholds in KanjiVG units (under 20
  and 30), which never applied on AnimCJK's 1024 box: a dot had to be
  placed about four times more precisely than a long stroke. Strokes
  shorter than `shortStrokeFloor` × the viewBox size are now judged as if
  they had that length, and their minimum drawn length (`minLengthRatio`)
  eases off with the square root of the shortfall, so a quick flick for a
  dot is not rejected as too short. Long strokes score as before; on
  KanjiVG the floor (≈33 units) stands in for the old boost.

---

## [1.3.0] – 2026-03-19

### Added (`@kaspars/kaku`)
- `Kaku.setShowOutline(value: boolean)` — toggle the outline overlay on the
  currently loaded character without a full dispose + recreate cycle.
- In-memory character cache in `KanjiVGProvider` and `AnimCJKProvider` —
  repeat `kaku.load()` calls for the same character return instantly without
  a network round-trip.

### Changed (`@kaspars/kaku-ren`)
- `KakuRen` no longer throws during construction when `kaku.load()` has not
  been called yet. `setupLayering()` is now deferred to `refresh()`, so
  construction order no longer matters.
- `showGuide` default changed from `true` to `false`. The option has been
  deprecated since 1.1.0 in favour of Kaku's `showOutline`; the old default
  caused a double-overlay when both were used together.
- `refresh()` now validates that the KakuRen `size` matches the Kaku SVG
  dimensions and throws a descriptive error (`KakuRen size 200×200 does not
  match Kaku SVG size 300×300 …`) if they differ.

---

## [1.2.0] – 2026-02-XX

### Added
- `size` option on `Kaku`, `KakuRen`, and `SvgRenderer` — sets width and
  height together with a single value.
- `@kaspars/kaku`: KanjiVG and AnimCJK data source credits in README.

### Deprecated
- `width` and `height` options on `Kaku`, `KakuRen`, and `SvgRenderer` in
  favour of the new unified `size` option.

---

## [1.1.0] – 2026-01-XX

### Added (`@kaspars/kaku`)
- `AnimCJKProvider` — data provider for AnimCJK stroke data (Japanese,
  Simplified/Traditional Chinese, Korean).
- `AnimCJKRenderer` — renderer that wraps native AnimCJK self-animating SVGs.
- `KakuDiagram` — renders a character's stroke order as a row of cumulative
  SVGs (one per stroke).
- `showOutline` and `outlineColor` options on `Kaku` — draw faint background
  strokes behind the animated layer.
- Draw animation for `AnimCJKRenderer` strokes via `stroke-dashoffset`.

### Added (`@kaspars/kaku-ren`)
- Animated stroke direction hints on rejection — the correct stroke is drawn
  in a hint colour to guide the user.
- `hintColor` and `hintDuration` options.

### Deprecated (`@kaspars/kaku-ren`)
- `showGuide` option in favour of Kaku's `showOutline`.
- `guideColor` option in favour of Kaku's `outlineColor`.

---

## [1.0.1] – 2025-12-XX

### Changed
- README improvements and cross-linked package docs on npm.

---

## [1.0.0] – 2025-12-XX

Initial release of `@kaspars/kaku` and `@kaspars/kaku-ren`.

### `@kaspars/kaku`
- `Kaku` class — orchestrates provider, renderer, and animator.
- `KanjiVGProvider` — fetches stroke data from KanjiVG SVG files.
- `SvgRenderer` — CSS transition-based SVG renderer.
- `StrokeAnimator` — `play`, `pause`, `reset`, `nextStroke`, `previousStroke`.
- `strokeEffect` option: `'draw'` (default), `'fade'`, `'none'`.
- Animation events: `start`, `pause`, `resume`, `reset`, `strokeStart`,
  `strokeComplete`, `complete`.

### `@kaspars/kaku-ren`
- `KakuRen` class — drawing canvas overlay with stroke evaluation.
- `StrokeInput` — pointer-events canvas for freehand input.
- Stroke evaluation: direction, coverage, and length scoring.
- `onAccept`, `onReject`, `onComplete` callbacks.
