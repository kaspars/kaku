# Kaku Ren

CJK character stroke practice library. Captures user drawing input on a canvas overlay and evaluates stroke accuracy against expected strokes from [Kaku](../kaku/).

## Installation

```bash
npm install kaku-ren kaku
```

## Overview

Kaku Ren adds interactive stroke practice on top of Kaku's animation engine:

1. Displays a canvas overlay on top of the Kaku SVG
2. Captures mouse/touch/pointer input as the user draws strokes
3. Evaluates each stroke against the expected path (shape, length, direction)
4. Provides visual feedback: morphs accepted strokes into the correct form, flashes on rejection
5. Shows hints after repeated failures

## Status

Under development.

## License

MIT
