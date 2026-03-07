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

// Mock SVGPathElement methods for jsdom
if (typeof SVGPathElement !== 'undefined') {
  SVGPathElement.prototype.getTotalLength = function () {
    const d = this.getAttribute('d') || '';
    const points: [number, number][] = [];
    const coordRegex = /(-?\d+\.?\d*),?\s*(-?\d+\.?\d*)/g;
    let match;
    while ((match = coordRegex.exec(d)) !== null) {
      points.push([parseFloat(match[1]), parseFloat(match[2])]);
    }
    if (points.length < 2) return 100;
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i][0] - points[i - 1][0];
      const dy = points[i][1] - points[i - 1][1];
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return length || 100;
  };

  SVGPathElement.prototype.getPointAtLength = function (len: number) {
    const d = this.getAttribute('d') || '';
    const points: [number, number][] = [];
    const coordRegex = /(-?\d+\.?\d*),?\s*(-?\d+\.?\d*)/g;
    let match;
    while ((match = coordRegex.exec(d)) !== null) {
      points.push([parseFloat(match[1]), parseFloat(match[2])]);
    }
    if (points.length === 0) return { x: 0, y: 0 } as SVGPoint;
    if (points.length === 1) return { x: points[0][0], y: points[0][1] } as SVGPoint;

    // Walk segments to find position at len
    let remaining = Math.max(0, len);
    for (let i = 1; i < points.length; i++) {
      const dx = points[i][0] - points[i - 1][0];
      const dy = points[i][1] - points[i - 1][1];
      const segLen = Math.sqrt(dx * dx + dy * dy);
      if (remaining <= segLen || i === points.length - 1) {
        const t = segLen > 0 ? remaining / segLen : 0;
        return {
          x: points[i - 1][0] + t * dx,
          y: points[i - 1][1] + t * dy,
        } as SVGPoint;
      }
      remaining -= segLen;
    }
    const last = points[points.length - 1];
    return { x: last[0], y: last[1] } as SVGPoint;
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
