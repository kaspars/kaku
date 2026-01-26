import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createStrokePath } from '../../src/renderer/stroke-path';
import type { Stroke } from '../../src/types';

describe('createStrokePath', () => {
  const mockStroke: Stroke = {
    pathData: 'M10,10 L50,50',
    metadata: { index: 0, type: '㇐', sourceId: 'test-s1' },
  };

  it('should create path element with correct attributes', () => {
    const rendered = createStrokePath(mockStroke);

    expect(rendered.element.tagName).toBe('path');
    expect(rendered.element.getAttribute('d')).toBe('M10,10 L50,50');
    expect(rendered.element.getAttribute('fill')).toBe('none');
    expect(rendered.element.getAttribute('stroke-linecap')).toBe('round');
    expect(rendered.element.getAttribute('stroke-linejoin')).toBe('round');
  });

  it('should use default stroke color and width', () => {
    const rendered = createStrokePath(mockStroke);

    expect(rendered.element.getAttribute('stroke')).toBe('#000');
    expect(rendered.element.getAttribute('stroke-width')).toBe('3');
  });

  it('should use custom stroke color and width', () => {
    const rendered = createStrokePath(mockStroke, {
      strokeColor: '#ff0000',
      strokeWidth: 5,
    });

    expect(rendered.element.getAttribute('stroke')).toBe('#ff0000');
    expect(rendered.element.getAttribute('stroke-width')).toBe('5');
  });

  it('should calculate path length', () => {
    const rendered = createStrokePath(mockStroke);

    // The diagonal from (10,10) to (50,50) should be ~56.57
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeCloseTo(56.57, 0);
  });

  it('should initialize stroke as hidden', () => {
    const rendered = createStrokePath(mockStroke);

    expect(rendered.element.style.strokeDasharray).toBe(String(rendered.length));
    expect(rendered.element.style.strokeDashoffset).toBe(String(rendered.length));
  });

  it('should store original stroke data', () => {
    const rendered = createStrokePath(mockStroke);

    expect(rendered.stroke).toBe(mockStroke);
  });

  describe('setProgress', () => {
    it('should set progress to 0 (hidden)', () => {
      const rendered = createStrokePath(mockStroke);
      rendered.setProgress(0);

      expect(rendered.element.style.strokeDashoffset).toBe(String(rendered.length));
    });

    it('should set progress to 1 (fully visible)', () => {
      const rendered = createStrokePath(mockStroke);
      rendered.setProgress(1);

      expect(rendered.element.style.strokeDashoffset).toBe('0');
    });

    it('should set progress to 0.5 (half visible)', () => {
      const rendered = createStrokePath(mockStroke);
      rendered.setProgress(0.5);

      const expectedOffset = rendered.length * 0.5;
      expect(parseFloat(rendered.element.style.strokeDashoffset)).toBeCloseTo(
        expectedOffset,
        2
      );
    });

    it('should clamp progress below 0', () => {
      const rendered = createStrokePath(mockStroke);
      rendered.setProgress(-0.5);

      expect(rendered.element.style.strokeDashoffset).toBe(String(rendered.length));
    });

    it('should clamp progress above 1', () => {
      const rendered = createStrokePath(mockStroke);
      rendered.setProgress(1.5);

      expect(rendered.element.style.strokeDashoffset).toBe('0');
    });
  });

  describe('setTransition', () => {
    it('should set CSS transition', () => {
      const rendered = createStrokePath(mockStroke);
      rendered.setTransition(0.5);

      expect(rendered.element.style.transition).toBe(
        'stroke-dashoffset 0.5s ease'
      );
    });

    it('should use custom easing', () => {
      const rendered = createStrokePath(mockStroke);
      rendered.setTransition(1, 'linear');

      expect(rendered.element.style.transition).toBe(
        'stroke-dashoffset 1s linear'
      );
    });
  });

  describe('clearTransition', () => {
    it('should remove transition', () => {
      const rendered = createStrokePath(mockStroke);
      rendered.setTransition(0.5);
      rendered.clearTransition();

      expect(rendered.element.style.transition).toBe('none');
    });
  });
});
