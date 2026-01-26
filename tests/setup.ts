import { vi } from 'vitest';

// Mock getTotalLength for jsdom which doesn't implement it
if (typeof SVGPathElement !== 'undefined') {
  SVGPathElement.prototype.getTotalLength = function () {
    // Parse the d attribute and estimate length
    // This is a simple approximation for testing
    const d = this.getAttribute('d') || '';

    // Try to extract coordinates and calculate rough length
    const points: [number, number][] = [];
    const coordRegex = /(-?\d+\.?\d*),?\s*(-?\d+\.?\d*)/g;
    let match;

    while ((match = coordRegex.exec(d)) !== null) {
      points.push([parseFloat(match[1]), parseFloat(match[2])]);
    }

    if (points.length < 2) {
      return 100; // Default fallback
    }

    // Calculate total distance
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i][0] - points[i - 1][0];
      const dy = points[i][1] - points[i - 1][1];
      length += Math.sqrt(dx * dx + dy * dy);
    }

    return length || 100;
  };
}

// Mock getBoundingClientRect
if (typeof SVGElement !== 'undefined') {
  const originalGetBoundingClientRect = SVGElement.prototype.getBoundingClientRect;
  SVGElement.prototype.getBoundingClientRect = function () {
    // Return a mock DOMRect if the original returns nothing useful
    const result = originalGetBoundingClientRect?.call(this);
    if (result && (result.width > 0 || result.height > 0)) {
      return result;
    }
    return {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      top: 0,
      right: 100,
      bottom: 100,
      left: 0,
      toJSON: () => ({}),
    };
  };
}
