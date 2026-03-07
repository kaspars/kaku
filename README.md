# Kaku

TypeScript libraries for CJK character stroke animation and practice.

## Packages

| Package | Description |
|---------|-------------|
| [kaku](packages/kaku/) | Stroke animation library with pluggable data adapters |
| [kaku-ren](packages/kaku-ren/) | Stroke practice with drawing input and evaluation |

Kaku Ren depends on Kaku. Kaku works standalone.

## Demo

1. Install dependencies: `npm install`
2. Download [KanjiVG](https://github.com/KanjiVG/kanjivg) SVG files into `public/kanjivg/`
3. Start the dev server: `npm run dev`
4. Open `http://localhost:5173`

## Development

```bash
npm install              # Install dependencies
npm run dev              # Start dev server with demo
npm test                 # Run all tests
npm test -w kaku         # Run kaku tests only
npm test -w kaku-ren     # Run kaku-ren tests only
npm run test:coverage    # Run all tests with coverage
npm run build            # Build all packages
```

## License

MIT
