import { describe, it, expect } from 'vitest';
import {
  createSvgElement,
  createSvg,
  createPath,
  createLine,
  createGroup,
} from '../../src/utils/svg';

describe('svg utilities', () => {
  describe('createSvgElement', () => {
    it('should create element with correct namespace', () => {
      const rect = createSvgElement('rect');
      expect(rect.namespaceURI).toBe('http://www.w3.org/2000/svg');
      expect(rect.tagName).toBe('rect');
    });

    it('should set string attributes', () => {
      const rect = createSvgElement('rect', { id: 'test', fill: 'red' });
      expect(rect.getAttribute('id')).toBe('test');
      expect(rect.getAttribute('fill')).toBe('red');
    });

    it('should convert number attributes to string', () => {
      const rect = createSvgElement('rect', { width: 100, height: 50 });
      expect(rect.getAttribute('width')).toBe('100');
      expect(rect.getAttribute('height')).toBe('50');
    });
  });

  describe('createSvg', () => {
    it('should create svg with viewBox', () => {
      const svg = createSvg([0, 0, 109, 109]);
      expect(svg.tagName).toBe('svg');
      expect(svg.getAttribute('viewBox')).toBe('0 0 109 109');
    });

    it('should set width and height when provided', () => {
      const svg = createSvg([0, 0, 100, 100], 200, 200);
      expect(svg.getAttribute('width')).toBe('200');
      expect(svg.getAttribute('height')).toBe('200');
    });

    it('should accept string dimensions', () => {
      const svg = createSvg([0, 0, 100, 100], '100%', '100%');
      expect(svg.getAttribute('width')).toBe('100%');
      expect(svg.getAttribute('height')).toBe('100%');
    });
  });

  describe('createPath', () => {
    it('should create path with d attribute', () => {
      const path = createPath('M10,10 L20,20');
      expect(path.tagName).toBe('path');
      expect(path.getAttribute('d')).toBe('M10,10 L20,20');
    });

    it('should set additional attributes', () => {
      const path = createPath('M0,0', { stroke: 'black', fill: 'none' });
      expect(path.getAttribute('stroke')).toBe('black');
      expect(path.getAttribute('fill')).toBe('none');
    });
  });

  describe('createLine', () => {
    it('should create line with coordinates', () => {
      const line = createLine(0, 0, 100, 100);
      expect(line.tagName).toBe('line');
      expect(line.getAttribute('x1')).toBe('0');
      expect(line.getAttribute('y1')).toBe('0');
      expect(line.getAttribute('x2')).toBe('100');
      expect(line.getAttribute('y2')).toBe('100');
    });

    it('should set additional attributes', () => {
      const line = createLine(0, 0, 100, 100, { stroke: '#ccc' });
      expect(line.getAttribute('stroke')).toBe('#ccc');
    });
  });

  describe('createGroup', () => {
    it('should create g element', () => {
      const group = createGroup();
      expect(group.tagName).toBe('g');
    });

    it('should set attributes', () => {
      const group = createGroup({ id: 'strokes', class: 'stroke-group' });
      expect(group.getAttribute('id')).toBe('strokes');
      expect(group.getAttribute('class')).toBe('stroke-group');
    });
  });
});
