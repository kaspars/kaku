# Changelog

All notable changes to `@kaspars/kaku` and `@kaspars/kaku-ren` are documented
here. Both packages are versioned together.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
