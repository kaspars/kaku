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
