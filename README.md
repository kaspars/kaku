# Kaku

TypeScript libraries for CJK character stroke animation and practice.

## Packages

| Package | Description |
|---------|-------------|
| [@kaspars/kaku](packages/kaku/) | Stroke animation library with pluggable data adapters |
| [@kaspars/kaku-ren](packages/kaku-ren/) | Stroke practice with drawing input and evaluation |

Kaku Ren depends on Kaku. Kaku works standalone.

## Demo

**[Live demo](https://kaspars.github.io/kaku/)** — try stroke animation and practice in the browser.

To run locally:

```bash
npm install
npm run dev
open http://localhost:5173
```

## Development

```bash
npm install              # Install dependencies
npm run dev              # Start dev server with demo
npm test                 # Run all tests
npm test -w @kaspars/kaku         # Run kaku tests only
npm test -w @kaspars/kaku-ren     # Run kaku-ren tests only
npm run test:coverage    # Run all tests with coverage
npm run build            # Build all packages
```

## License

MIT
