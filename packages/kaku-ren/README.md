# Kaku Ren

CJK character stroke practice library. Captures user drawing input on a canvas overlay and evaluates stroke accuracy against expected strokes from [@kaspars/kaku](https://www.npmjs.com/package/@kaspars/kaku).

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
5. Shows animated hints on incorrect attempts

## License

MIT
