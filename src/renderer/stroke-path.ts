import type { RenderedStroke, Stroke } from '../types/index.js';
import { createPath } from '../utils/svg.js';

/**
 * Options for creating a stroke path
 */
export interface StrokePathOptions {
  strokeColor?: string;
  strokeWidth?: number;
}

/**
 * Calculate path length with fallback for environments that don't support getTotalLength
 */
function getPathLength(element: SVGPathElement): number {
  // Check if getTotalLength is available
  if (typeof element.getTotalLength === 'function') {
    try {
      return element.getTotalLength();
    } catch {
      // Fall through to estimation
    }
  }

  // Fallback: estimate from path data
  const d = element.getAttribute('d') || '';
  return estimatePathLength(d);
}

/**
 * Estimate path length from path data string
 */
function estimatePathLength(d: string): number {
  const points: [number, number][] = [];
  const coordRegex = /(-?\d+\.?\d*),?\s*(-?\d+\.?\d*)/g;
  let match;

  while ((match = coordRegex.exec(d)) !== null) {
    points.push([parseFloat(match[1]), parseFloat(match[2])]);
  }

  if (points.length < 2) {
    return 100; // Default fallback
  }

  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    length += Math.sqrt(dx * dx + dy * dy);
  }

  return length || 100;
}

/**
 * Create a rendered stroke path from stroke data
 */
export function createStrokePath(
  stroke: Stroke,
  options: StrokePathOptions = {}
): RenderedStroke {
  const { strokeColor = '#000', strokeWidth = 3 } = options;

  const element = createPath(stroke.pathData, {
    fill: 'none',
    stroke: strokeColor,
    'stroke-width': strokeWidth,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });

  // Get path length
  const length = getPathLength(element);

  // Initialize stroke to hidden state (for draw effect)
  element.style.strokeDasharray = String(length);
  element.style.strokeDashoffset = String(length);
  element.style.opacity = '1';

  return {
    element,
    length,
    stroke,

    setProgress(progress: number) {
      const clampedProgress = Math.max(0, Math.min(1, progress));
      const offset = length * (1 - clampedProgress);
      element.style.strokeDashoffset = String(offset);
    },

    setTransition(duration: number, easing = 'ease') {
      element.style.transition = `stroke-dashoffset ${duration}s ${easing}`;
    },

    clearTransition() {
      element.style.transition = 'none';
    },

    setOpacity(opacity: number) {
      const clampedOpacity = Math.max(0, Math.min(1, opacity));
      element.style.opacity = String(clampedOpacity);
    },

    setOpacityTransition(duration: number, easing = 'ease') {
      element.style.transition = `opacity ${duration}s ${easing}`;
    },

    clearOpacityTransition() {
      element.style.transition = 'none';
    },
  };
}
