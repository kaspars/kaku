import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SvgRenderer } from '../../src/renderer/svg-renderer';
import type { CharacterData } from '../../src/types';

describe('SvgRenderer', () => {
  let container: HTMLDivElement;
  let renderer: SvgRenderer;

  const mockCharacterData: CharacterData = {
    character: '一',
    codePoints: [0x4e00],
    viewBox: [0, 0, 109, 109],
    strokes: [
      {
        pathData: 'M10,50 L100,50',
        metadata: { index: 0, type: '㇐', sourceId: 'test-s1' },
      },
    ],
    source: 'test',
  };

  const multiStrokeData: CharacterData = {
    character: '十',
    codePoints: [0x5341],
    viewBox: [0, 0, 109, 109],
    strokes: [
      {
        pathData: 'M10,50 L100,50',
        metadata: { index: 0, type: '㇐', sourceId: 'test-s1' },
      },
      {
        pathData: 'M50,10 L50,100',
        metadata: { index: 1, type: '㇑', sourceId: 'test-s2' },
      },
    ],
    source: 'test',
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    renderer = new SvgRenderer({ container });
  });

  afterEach(() => {
    renderer.dispose();
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('render', () => {
    it('should create SVG element in container', () => {
      renderer.render(mockCharacterData);

      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
    });

    it('should set viewBox from character data', () => {
      renderer.render(mockCharacterData);

      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('viewBox')).toBe('0 0 109 109');
    });

    it('should render correct number of strokes', () => {
      const strokes = renderer.render(multiStrokeData);

      expect(strokes).toHaveLength(2);
      expect(container.querySelectorAll('path')).toHaveLength(2);
    });

    it('should return rendered stroke objects', () => {
      const strokes = renderer.render(mockCharacterData);

      expect(strokes[0].element.tagName).toBe('path');
      expect(strokes[0].length).toBeGreaterThan(0);
      expect(typeof strokes[0].setProgress).toBe('function');
      expect(typeof strokes[0].setTransition).toBe('function');
    });

    it('should apply stroke color option', () => {
      renderer.render(mockCharacterData, { strokeColor: '#ff0000' });

      const path = container.querySelector('path');
      expect(path?.getAttribute('stroke')).toBe('#ff0000');
    });

    it('should apply stroke width option', () => {
      renderer.render(mockCharacterData, { strokeWidth: 5 });

      const path = container.querySelector('path');
      expect(path?.getAttribute('stroke-width')).toBe('5');
    });

    it('should clear previous render when called again', () => {
      renderer.render(mockCharacterData);
      renderer.render(multiStrokeData);

      expect(container.querySelectorAll('svg')).toHaveLength(1);
      expect(container.querySelectorAll('path')).toHaveLength(2);
    });
  });

  describe('grid', () => {
    it('should not show grid by default', () => {
      renderer.render(mockCharacterData);

      const lines = container.querySelectorAll('line');
      expect(lines).toHaveLength(0);
    });

    it('should show grid when showGrid is true', () => {
      renderer.render(mockCharacterData, { showGrid: true });

      const lines = container.querySelectorAll('line');
      expect(lines).toHaveLength(2); // vertical + horizontal
    });

    it('should use custom grid color', () => {
      renderer.render(mockCharacterData, { showGrid: true, gridColor: '#eee' });

      const lines = container.querySelectorAll('line');
      expect(lines[0].getAttribute('stroke')).toBe('#eee');
    });

    it('should position grid lines at center', () => {
      renderer.render(mockCharacterData, { showGrid: true });

      const lines = Array.from(container.querySelectorAll('line'));

      // Find vertical line (x1 = x2)
      const verticalLine = lines.find(
        (l) => l.getAttribute('x1') === l.getAttribute('x2')
      );
      expect(verticalLine?.getAttribute('x1')).toBe('54.5');

      // Find horizontal line (y1 = y2)
      const horizontalLine = lines.find(
        (l) => l.getAttribute('y1') === l.getAttribute('y2')
      );
      expect(horizontalLine?.getAttribute('y1')).toBe('54.5');
    });
  });

  describe('getSvg', () => {
    it('should return SVG element after render', () => {
      renderer.render(mockCharacterData);

      const svg = renderer.getSvg();
      expect(svg.tagName).toBe('svg');
    });

    it('should throw if called before render', () => {
      expect(() => renderer.getSvg()).toThrow('No SVG element');
    });
  });

  describe('clear', () => {
    it('should remove SVG from container', () => {
      renderer.render(mockCharacterData);
      renderer.clear();

      expect(container.querySelector('svg')).toBeNull();
    });

    it('should be safe to call multiple times', () => {
      renderer.render(mockCharacterData);
      renderer.clear();
      renderer.clear();

      expect(container.querySelector('svg')).toBeNull();
    });
  });

  describe('dispose', () => {
    it('should clean up SVG', () => {
      renderer.render(mockCharacterData);
      renderer.dispose();

      expect(container.querySelector('svg')).toBeNull();
    });
  });

  describe('dimensions', () => {
    it('should use default dimensions', () => {
      renderer.render(mockCharacterData);

      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('width')).toBe('200');
      expect(svg?.getAttribute('height')).toBe('200');
    });

    it('should use custom dimensions', () => {
      const customRenderer = new SvgRenderer({
        container,
        width: 300,
        height: 300,
      });
      customRenderer.render(mockCharacterData);

      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('width')).toBe('300');
      expect(svg?.getAttribute('height')).toBe('300');
    });

    it('should accept string dimensions', () => {
      const customRenderer = new SvgRenderer({
        container,
        width: '100%',
        height: '100%',
      });
      customRenderer.render(mockCharacterData);

      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('width')).toBe('100%');
      expect(svg?.getAttribute('height')).toBe('100%');
    });
  });
});
