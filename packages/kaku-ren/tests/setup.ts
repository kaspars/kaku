// Mock PointerEvent for jsdom (not implemented)
if (typeof globalThis.PointerEvent === 'undefined') {
  (globalThis as any).PointerEvent = class PointerEvent extends MouseEvent {
    readonly pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  };
}

// Mock setPointerCapture/releasePointerCapture
Element.prototype.setPointerCapture = Element.prototype.setPointerCapture ?? (() => {});
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});

// ---- SVG path mini-parser for jsdom mocks ----
// Handles M, m, L, l, C, c, S, s, Q, q, H, h, V, v, Z commands
// (covers KanjiVG path data)

type Vec2 = [number, number];

function parseSvgPath(d: string): Vec2[] {
  // Tokenize: split into commands and numbers
  const tokens: (string | number)[] = [];
  const re = /([MmLlCcSsQqHhVvZz])|(-?\d+\.?\d*(?:e[+-]?\d+)?)/g;
  let m;
  while ((m = re.exec(d)) !== null) {
    if (m[1]) tokens.push(m[1]);
    else tokens.push(parseFloat(m[2]));
  }

  const points: Vec2[] = [];
  let cx = 0, cy = 0; // current position
  let i = 0;

  function num(): number {
    return tokens[i++] as number;
  }

  while (i < tokens.length) {
    const cmd = tokens[i];
    if (typeof cmd === 'string') {
      i++;
      switch (cmd) {
        case 'M':
          cx = num(); cy = num();
          points.push([cx, cy]);
          // Implicit L after M
          while (i < tokens.length && typeof tokens[i] === 'number') {
            cx = num(); cy = num();
            points.push([cx, cy]);
          }
          break;
        case 'm':
          cx += num(); cy += num();
          points.push([cx, cy]);
          while (i < tokens.length && typeof tokens[i] === 'number') {
            cx += num(); cy += num();
            points.push([cx, cy]);
          }
          break;
        case 'L':
          while (i < tokens.length && typeof tokens[i] === 'number') {
            cx = num(); cy = num();
            points.push([cx, cy]);
          }
          break;
        case 'l':
          while (i < tokens.length && typeof tokens[i] === 'number') {
            cx += num(); cy += num();
            points.push([cx, cy]);
          }
          break;
        case 'H':
          while (i < tokens.length && typeof tokens[i] === 'number') {
            cx = num();
            points.push([cx, cy]);
          }
          break;
        case 'h':
          while (i < tokens.length && typeof tokens[i] === 'number') {
            cx += num();
            points.push([cx, cy]);
          }
          break;
        case 'V':
          while (i < tokens.length && typeof tokens[i] === 'number') {
            cy = num();
            points.push([cx, cy]);
          }
          break;
        case 'v':
          while (i < tokens.length && typeof tokens[i] === 'number') {
            cy += num();
            points.push([cx, cy]);
          }
          break;
        case 'C': {
          // Cubic Bézier: C x1 y1 x2 y2 x y
          while (i < tokens.length && typeof tokens[i] === 'number') {
            const x1 = num(), y1 = num();
            const x2 = num(), y2 = num();
            const x = num(), y = num();
            // Flatten: sample the cubic Bézier into sub-segments
            flattenCubic(points, cx, cy, x1, y1, x2, y2, x, y);
            cx = x; cy = y;
          }
          break;
        }
        case 'c': {
          // Relative cubic Bézier
          while (i < tokens.length && typeof tokens[i] === 'number') {
            const dx1 = num(), dy1 = num();
            const dx2 = num(), dy2 = num();
            const dx = num(), dy = num();
            flattenCubic(points, cx, cy, cx + dx1, cy + dy1, cx + dx2, cy + dy2, cx + dx, cy + dy);
            cx += dx; cy += dy;
          }
          break;
        }
        case 'S': {
          while (i < tokens.length && typeof tokens[i] === 'number') {
            const x2 = num(), y2 = num();
            const x = num(), y = num();
            // Smooth cubic: reflect previous control point
            flattenCubic(points, cx, cy, cx, cy, x2, y2, x, y);
            cx = x; cy = y;
          }
          break;
        }
        case 's': {
          while (i < tokens.length && typeof tokens[i] === 'number') {
            const dx2 = num(), dy2 = num();
            const dx = num(), dy = num();
            flattenCubic(points, cx, cy, cx, cy, cx + dx2, cy + dy2, cx + dx, cy + dy);
            cx += dx; cy += dy;
          }
          break;
        }
        case 'Q': {
          while (i < tokens.length && typeof tokens[i] === 'number') {
            const qx1 = num(), qy1 = num();
            const x = num(), y = num();
            flattenQuadratic(points, cx, cy, qx1, qy1, x, y);
            cx = x; cy = y;
          }
          break;
        }
        case 'q': {
          while (i < tokens.length && typeof tokens[i] === 'number') {
            const dqx1 = num(), dqy1 = num();
            const dx = num(), dy = num();
            flattenQuadratic(points, cx, cy, cx + dqx1, cy + dqy1, cx + dx, cy + dy);
            cx += dx; cy += dy;
          }
          break;
        }
        case 'Z':
        case 'z':
          break;
      }
    } else {
      i++; // skip unexpected tokens
    }
  }

  return points;
}

function flattenCubic(
  out: Vec2[], x0: number, y0: number,
  x1: number, y1: number, x2: number, y2: number, x3: number, y3: number,
  steps = 16,
): void {
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const u = 1 - t;
    const x = u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3;
    const y = u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
    out.push([x, y]);
  }
}

function flattenQuadratic(
  out: Vec2[], x0: number, y0: number,
  x1: number, y1: number, x2: number, y2: number,
  steps = 16,
): void {
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const u = 1 - t;
    const x = u * u * x0 + 2 * u * t * x1 + t * t * x2;
    const y = u * u * y0 + 2 * u * t * y1 + t * t * y2;
    out.push([x, y]);
  }
}

function segmentLength(pts: Vec2[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

function pointAtDist(pts: Vec2[], dist: number): Vec2 {
  if (pts.length === 0) return [0, 0];
  if (pts.length === 1) return pts[0];

  let remaining = Math.max(0, dist);
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (remaining <= segLen || i === pts.length - 1) {
      const t = segLen > 0 ? remaining / segLen : 0;
      return [pts[i - 1][0] + t * dx, pts[i - 1][1] + t * dy];
    }
    remaining -= segLen;
  }
  return pts[pts.length - 1];
}

// Mock SVG path geometry methods on SVGElement.prototype for jsdom.
// jsdom creates generic SVGElement (not SVGPathElement) for <path> elements.
if (typeof SVGElement !== 'undefined') {
  (SVGElement.prototype as any).getTotalLength = function () {
    const d = this.getAttribute('d') || '';
    const pts = parseSvgPath(d);
    if (pts.length < 2) return 100;
    return segmentLength(pts) || 100;
  };

  (SVGElement.prototype as any).getPointAtLength = function (len: number) {
    const d = this.getAttribute('d') || '';
    const pts = parseSvgPath(d);
    const pt = pointAtDist(pts, len);
    return { x: pt[0], y: pt[1] } as SVGPoint;
  };
}

// Mock SVGElement.getBoundingClientRect
if (typeof SVGElement !== 'undefined') {
  const orig = SVGElement.prototype.getBoundingClientRect;
  SVGElement.prototype.getBoundingClientRect = function () {
    const result = orig?.call(this);
    if (result && (result.width > 0 || result.height > 0)) return result;
    return { x: 0, y: 0, width: 100, height: 100, top: 0, right: 100, bottom: 100, left: 0, toJSON: () => ({}) } as DOMRect;
  };
}

// Mock Canvas 2D context for jsdom
function createMockContext(): CanvasRenderingContext2D {
  const noop = () => {};

  return {
    scale: noop,
    clearRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    stroke: noop,
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
  } as unknown as CanvasRenderingContext2D;
}

const contextMap = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();

HTMLCanvasElement.prototype.getContext = function (contextId: string) {
  if (contextId === '2d') {
    if (!contextMap.has(this)) {
      contextMap.set(this, createMockContext());
    }
    return contextMap.get(this)!;
  }
  return null;
} as typeof HTMLCanvasElement.prototype.getContext;
