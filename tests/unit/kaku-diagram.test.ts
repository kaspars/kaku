import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KakuDiagram } from '../../src/core/kaku-diagram';
import type { DataProvider, CharacterData, ProviderResult } from '../../src/types';

// Mock provider
function createMockProvider(data: CharacterData): DataProvider {
  return {
    id: 'mock',
    canHandle: vi.fn(() => true),
    getCharacter: vi.fn(() =>
      Promise.resolve({ success: true, data } as ProviderResult<CharacterData>)
    ),
  };
}

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
  source: 'mock',
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
  source: 'mock',
};

const threeStrokeData: CharacterData = {
  character: '大',
  codePoints: [0x5927],
  viewBox: [0, 0, 109, 109],
  strokes: [
    {
      pathData: 'M10,30 L100,30',
      metadata: { index: 0, sourceId: 'test-s1' },
    },
    {
      pathData: 'M50,10 L20,100',
      metadata: { index: 1, sourceId: 'test-s2' },
    },
    {
      pathData: 'M50,10 L80,100',
      metadata: { index: 2, sourceId: 'test-s3' },
    },
  ],
  source: 'mock',
};

describe('KakuDiagram', () => {
  let container: HTMLDivElement;
  let provider: DataProvider;
  let diagram: KakuDiagram;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    provider = createMockProvider(mockCharacterData);
  });

  afterEach(() => {
    diagram?.dispose();
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('constructor', () => {
    it('should create instance with required options', () => {
      diagram = new KakuDiagram({ provider, container });

      expect(diagram.character).toBeNull();
      expect(diagram.totalStrokes).toBe(0);
    });
  });

  describe('load', () => {
    it('should load and render character diagram', async () => {
      diagram = new KakuDiagram({ provider, container });
      await diagram.load('一');

      expect(provider.getCharacter).toHaveBeenCalledWith('一');
      expect(diagram.character).toBe('一');
      expect(diagram.totalStrokes).toBe(1);
    });

    it('should render one SVG per stroke', async () => {
      provider = createMockProvider(multiStrokeData);
      diagram = new KakuDiagram({ provider, container });
      await diagram.load('十');

      const svgs = container.querySelectorAll('svg');
      expect(svgs).toHaveLength(2);
    });

    it('should render cumulative strokes in each SVG', async () => {
      provider = createMockProvider(threeStrokeData);
      diagram = new KakuDiagram({ provider, container });
      await diagram.load('大');

      const svgs = container.querySelectorAll('svg');
      expect(svgs).toHaveLength(3);

      // First SVG: 1 stroke
      expect(svgs[0].querySelectorAll('path')).toHaveLength(1);

      // Second SVG: 2 strokes
      expect(svgs[1].querySelectorAll('path')).toHaveLength(2);

      // Third SVG: 3 strokes
      expect(svgs[2].querySelectorAll('path')).toHaveLength(3);
    });

    it('should throw if provider cannot handle character', async () => {
      const restrictiveProvider = createMockProvider(mockCharacterData);
      (restrictiveProvider.canHandle as ReturnType<typeof vi.fn>).mockReturnValue(false);

      diagram = new KakuDiagram({ provider: restrictiveProvider, container });

      await expect(diagram.load('X')).rejects.toThrow('cannot handle character');
    });

    it('should throw if provider returns error', async () => {
      const errorProvider: DataProvider = {
        id: 'error',
        canHandle: () => true,
        getCharacter: () =>
          Promise.resolve({
            success: false,
            error: new Error('Not found'),
          }),
      };

      diagram = new KakuDiagram({ provider: errorProvider, container });

      await expect(diagram.load('一')).rejects.toThrow('Not found');
    });

    it('should throw if disposed', async () => {
      diagram = new KakuDiagram({ provider, container });
      diagram.dispose();

      await expect(diagram.load('一')).rejects.toThrow('disposed');
    });

    it('should reject multi-codepoint input', async () => {
      diagram = new KakuDiagram({ provider, container });

      await expect(diagram.load('漢字')).rejects.toThrow('single code point');
    });

    it('should clear previous diagrams on reload', async () => {
      provider = createMockProvider(multiStrokeData);
      diagram = new KakuDiagram({ provider, container });

      await diagram.load('十');
      expect(container.querySelectorAll('svg')).toHaveLength(2);

      // Change to single stroke character
      (provider.getCharacter as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockCharacterData,
      });

      await diagram.load('一');
      expect(container.querySelectorAll('svg')).toHaveLength(1);
    });

    it('should apply render options', async () => {
      diagram = new KakuDiagram({
        provider,
        container,
        strokeColor: '#ff0000',
        strokeWidth: 5,
        showGrid: true,
      });
      await diagram.load('一');

      const path = container.querySelector('path');
      expect(path?.getAttribute('stroke')).toBe('#ff0000');
      expect(path?.getAttribute('stroke-width')).toBe('5');
      expect(container.querySelectorAll('line')).toHaveLength(2);
    });
  });

  describe('getSvgElements', () => {
    it('should return array of SVG elements', async () => {
      provider = createMockProvider(multiStrokeData);
      diagram = new KakuDiagram({ provider, container });
      await diagram.load('十');

      const svgs = diagram.getSvgElements();
      expect(svgs).toHaveLength(2);
      expect(svgs[0].tagName).toBe('svg');
      expect(svgs[1].tagName).toBe('svg');
    });

    it('should return empty array before load', () => {
      diagram = new KakuDiagram({ provider, container });

      expect(diagram.getSvgElements()).toHaveLength(0);
    });
  });

  describe('getCharacterData', () => {
    it('should return null before load', () => {
      diagram = new KakuDiagram({ provider, container });

      expect(diagram.getCharacterData()).toBeNull();
    });

    it('should return character data after load', async () => {
      diagram = new KakuDiagram({ provider, container });
      await diagram.load('一');

      const data = diagram.getCharacterData();
      expect(data?.character).toBe('一');
      expect(data?.strokes).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('should remove all SVG elements', async () => {
      provider = createMockProvider(multiStrokeData);
      diagram = new KakuDiagram({ provider, container });
      await diagram.load('十');

      expect(container.querySelectorAll('svg')).toHaveLength(2);

      diagram.clear();

      expect(container.querySelectorAll('svg')).toHaveLength(0);
      expect(diagram.getSvgElements()).toHaveLength(0);
    });
  });

  describe('dispose', () => {
    it('should clean up resources', async () => {
      diagram = new KakuDiagram({ provider, container });
      await diagram.load('一');
      diagram.dispose();

      expect(container.querySelectorAll('svg')).toHaveLength(0);
      expect(diagram.getCharacterData()).toBeNull();
    });

    it('should be safe to call multiple times', () => {
      diagram = new KakuDiagram({ provider, container });
      diagram.dispose();
      diagram.dispose();

      // No error thrown
    });
  });

  describe('dimensions', () => {
    it('should apply custom width and height', async () => {
      diagram = new KakuDiagram({
        provider,
        container,
        width: 200,
        height: 200,
      });
      await diagram.load('一');

      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('width')).toBe('200');
      expect(svg?.getAttribute('height')).toBe('200');
    });
  });

  describe('grid', () => {
    it('should show grid when enabled', async () => {
      provider = createMockProvider(multiStrokeData);
      diagram = new KakuDiagram({
        provider,
        container,
        showGrid: true,
        gridColor: '#e0e0e0',
      });
      await diagram.load('十');

      // Each SVG should have 2 grid lines (vertical and horizontal center)
      const svgs = container.querySelectorAll('svg');
      for (const svg of svgs) {
        const lines = svg.querySelectorAll('line');
        expect(lines).toHaveLength(2);
        expect(lines[0].getAttribute('stroke')).toBe('#e0e0e0');
      }
    });

    it('should not show grid when disabled', async () => {
      diagram = new KakuDiagram({
        provider,
        container,
        showGrid: false,
      });
      await diagram.load('一');

      expect(container.querySelectorAll('line')).toHaveLength(0);
    });
  });
});
