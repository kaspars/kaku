import { describe, it, expect, beforeEach } from 'vitest';
import { AnimCJKRenderer } from '../../src/renderer/animcjk-renderer';
import type { CharacterData } from '../../src/types/character';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const kanjiSvg = readFileSync(
  resolve(__dirname, '../fixtures/animcjk-23383.svg'),
  'utf-8',
);
const kanaSvg = readFileSync(
  resolve(__dirname, '../fixtures/animcjk-12354.svg'),
  'utf-8',
);

function makeCharacterData(
  rawSvg: string,
  overrides: Partial<CharacterData> = {},
): CharacterData {
  return {
    character: '字',
    codePoints: [0x5b57],
    viewBox: [0, 0, 1024, 1024],
    strokes: Array.from({ length: 6 }, (_, i) => ({
      pathData: `M${i} ${i}`,
      metadata: { index: i, sourceId: `z23383c${i + 1}` },
    })),
    source: 'animcjk',
    rawSvg,
    ...overrides,
  };
}

describe('AnimCJKRenderer', () => {
  let container: HTMLElement;
  let renderer: AnimCJKRenderer;

  beforeEach(() => {
    container = document.createElement('div');
    renderer = new AnimCJKRenderer({ container });
  });

  describe('render', () => {
    it('should create an SVG element in the container', () => {
      const data = makeCharacterData(kanjiSvg);
      renderer.render(data);

      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg!.getAttribute('viewBox')).toBe('0 0 1024 1024');
    });

    it('should strip the embedded <style> block', () => {
      const data = makeCharacterData(kanjiSvg);
      renderer.render(data);

      const svg = container.querySelector('svg')!;
      const styles = svg.querySelectorAll('style');
      // Should have exactly one style — our control CSS
      expect(styles).toHaveLength(1);
      expect(styles[0].textContent).toContain('path[clip-path]');
      expect(styles[0].textContent).not.toContain('@keyframes');
    });

    it('should preserve shape paths (outline definitions)', () => {
      const data = makeCharacterData(kanjiSvg);
      renderer.render(data);

      const svg = container.querySelector('svg')!;
      // Shape paths have id attributes
      const shapePaths = svg.querySelectorAll('path[id]');
      expect(shapePaths.length).toBe(6);
    });

    it('should preserve clip-path definitions', () => {
      const data = makeCharacterData(kanjiSvg);
      renderer.render(data);

      const svg = container.querySelector('svg')!;
      const clipPaths = svg.querySelectorAll('clipPath');
      expect(clipPaths.length).toBe(6);
    });

    it('should preserve stroke paths (direction polylines)', () => {
      const data = makeCharacterData(kanjiSvg);
      renderer.render(data);

      const svg = container.querySelector('svg')!;
      const strokePaths = svg.querySelectorAll('path[clip-path]');
      expect(strokePaths.length).toBe(6);
    });

    it('should return correct number of rendered strokes', () => {
      const data = makeCharacterData(kanjiSvg);
      const strokes = renderer.render(data);

      expect(strokes).toHaveLength(6);
    });

    it('should start all strokes as hidden via dashoffset', () => {
      const data = makeCharacterData(kanjiSvg);
      renderer.render(data);

      const svg = container.querySelector('svg')!;
      const strokePaths = svg.querySelectorAll('path[clip-path]') as NodeListOf<SVGPathElement>;
      for (const path of strokePaths) {
        expect(path.style.strokeDashoffset).toBe('3337');
        expect(path.style.strokeDasharray).toBe('3337');
      }
    });

    it('should throw when rawSvg is missing', () => {
      const data = makeCharacterData(kanjiSvg);
      delete (data as Record<string, unknown>).rawSvg;

      expect(() => renderer.render(data)).toThrow(
        'AnimCJKRenderer requires rawSvg',
      );
    });

    it('should apply custom stroke color', () => {
      const data = makeCharacterData(kanjiSvg);
      renderer.render(data, { strokeColor: '#f00' });

      const svg = container.querySelector('svg')!;
      const style = svg.querySelector('style')!;
      expect(style.textContent).toContain('stroke: #f00');
    });

    it('should add grid when showGrid is true', () => {
      const data = makeCharacterData(kanjiSvg);
      renderer.render(data, { showGrid: true });

      const svg = container.querySelector('svg')!;
      const lines = svg.querySelectorAll('line');
      expect(lines.length).toBe(2); // horizontal + vertical
    });
  });

  describe('RenderedStroke', () => {
    it('should fully reveal stroke when setProgress(1)', () => {
      const data = makeCharacterData(kanjiSvg);
      const strokes = renderer.render(data);

      strokes[0].setProgress(1);

      expect(strokes[0].element.style.strokeDashoffset).toBe('0');
    });

    it('should hide stroke when setProgress(0)', () => {
      const data = makeCharacterData(kanjiSvg);
      const strokes = renderer.render(data);

      strokes[0].setProgress(1);
      strokes[0].setProgress(0);

      expect(strokes[0].element.style.strokeDashoffset).toBe('3337');
    });

    it('should partially reveal stroke at fractional progress', () => {
      const data = makeCharacterData(kanjiSvg);
      const strokes = renderer.render(data);

      strokes[0].setProgress(0.5);

      const offset = parseFloat(strokes[0].element.style.strokeDashoffset);
      expect(offset).toBeCloseTo(3337 * 0.5);
    });

    it('should animate all parts of multi-part strokes', () => {
      const kanaData: CharacterData = {
        character: 'あ',
        codePoints: [0x3042],
        viewBox: [0, 0, 1024, 1024],
        strokes: [
          { pathData: 'M0 0', metadata: { index: 0 } },
          { pathData: 'M1 1', metadata: { index: 1 } },
          { pathData: 'M2 2', metadata: { index: 2, sourceId: 'z12354c3a,z12354c3b' } },
        ],
        source: 'animcjk',
        rawSvg: kanaSvg,
      };

      const strokes = renderer.render(kanaData);
      expect(strokes).toHaveLength(3);

      // Stroke 3 (index 2) has two clip-path paths sharing --d:3s
      strokes[2].setProgress(1);

      // Both parts should be fully revealed
      const svg = container.querySelector('svg')!;
      const strokePaths = svg.querySelectorAll('path[clip-path]') as NodeListOf<SVGPathElement>;
      const part3a = strokePaths[2];
      const part3b = strokePaths[3];
      expect(part3a.style.strokeDashoffset).toBe('0');
      expect(part3b.style.strokeDashoffset).toBe('0');
    });

    it('should set transition on stroke paths', () => {
      const data = makeCharacterData(kanjiSvg);
      const strokes = renderer.render(data);

      strokes[0].setTransition(0.5, 'linear');
      expect(strokes[0].element.style.transition).toContain('stroke-dashoffset');
      expect(strokes[0].element.style.transition).toContain('0.5s');

      strokes[0].clearTransition();
      expect(strokes[0].element.style.transition).toBe('none');
    });

    it('should set opacity on all parts', () => {
      const data = makeCharacterData(kanjiSvg);
      const strokes = renderer.render(data);

      strokes[0].setOpacity(0.5);
      expect(strokes[0].element.style.opacity).toBe('0.5');
    });

    it('should have stroke reference', () => {
      const data = makeCharacterData(kanjiSvg);
      const strokes = renderer.render(data);

      expect(strokes[0].stroke).toBe(data.strokes[0]);
    });
  });

  describe('clear', () => {
    it('should remove SVG from container', () => {
      const data = makeCharacterData(kanjiSvg);
      renderer.render(data);
      expect(container.querySelector('svg')).not.toBeNull();

      renderer.clear();
      expect(container.querySelector('svg')).toBeNull();
    });

    it('should allow re-rendering after clear', () => {
      const data = makeCharacterData(kanjiSvg);
      renderer.render(data);
      renderer.clear();

      const strokes = renderer.render(data);
      expect(strokes).toHaveLength(6);
      expect(container.querySelector('svg')).not.toBeNull();
    });
  });

  describe('getSvg', () => {
    it('should return the SVG element after render', () => {
      const data = makeCharacterData(kanjiSvg);
      renderer.render(data);

      expect(renderer.getSvg()).toBe(container.querySelector('svg'));
    });

    it('should throw before render', () => {
      expect(() => renderer.getSvg()).toThrow('No SVG element');
    });
  });
});
