import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Kaku } from '../../src/core/kaku';
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

describe('Kaku', () => {
  let container: HTMLDivElement;
  let provider: DataProvider;
  let kaku: Kaku;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    provider = createMockProvider(mockCharacterData);
  });

  afterEach(() => {
    kaku?.dispose();
    vi.useRealTimers();
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('constructor', () => {
    it('should create instance with required options', () => {
      kaku = new Kaku({ provider, container });

      expect(kaku.state).toBe('idle');
      expect(kaku.character).toBeNull();
    });
  });

  describe('load', () => {
    it('should load and render character', async () => {
      kaku = new Kaku({ provider, container });
      await kaku.load('一');

      expect(provider.getCharacter).toHaveBeenCalledWith('一');
      expect(kaku.character).toBe('一');
      expect(kaku.totalStrokes).toBe(1);
      expect(container.querySelector('svg')).not.toBeNull();
    });

    it('should throw if provider cannot handle character', async () => {
      const restrictiveProvider = createMockProvider(mockCharacterData);
      (restrictiveProvider.canHandle as ReturnType<typeof vi.fn>).mockReturnValue(false);

      kaku = new Kaku({ provider: restrictiveProvider, container });

      await expect(kaku.load('X')).rejects.toThrow('cannot handle character');
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

      kaku = new Kaku({ provider: errorProvider, container });

      await expect(kaku.load('一')).rejects.toThrow('Not found');
    });

    it('should throw if disposed', async () => {
      kaku = new Kaku({ provider, container });
      kaku.dispose();

      await expect(kaku.load('一')).rejects.toThrow('disposed');
    });

    it('should reject multi-codepoint input', async () => {
      kaku = new Kaku({ provider, container });

      await expect(kaku.load('漢字')).rejects.toThrow('single code point');
    });

    it('should apply render options', async () => {
      kaku = new Kaku({
        provider,
        container,
        strokeColor: '#ff0000',
        strokeWidth: 5,
        showGrid: true,
      });
      await kaku.load('一');

      const path = container.querySelector('path');
      expect(path?.getAttribute('stroke')).toBe('#ff0000');
      expect(path?.getAttribute('stroke-width')).toBe('5');
      expect(container.querySelectorAll('line')).toHaveLength(2);
    });
  });

  describe('animation controls', () => {
    beforeEach(async () => {
      provider = createMockProvider(multiStrokeData);
      kaku = new Kaku({
        provider,
        container,
        animation: { strokeDuration: 0.5 },
      });
      await kaku.load('十');
    });

    it('play should start animation', () => {
      kaku.play();

      expect(kaku.state).toBe('playing');
    });

    it('pause should pause animation', () => {
      kaku.play();
      kaku.pause();

      expect(kaku.state).toBe('paused');
    });

    it('reset should reset animation', () => {
      kaku.play();
      vi.advanceTimersByTime(500);
      kaku.reset();

      expect(kaku.state).toBe('idle');
      expect(kaku.currentStroke).toBe(0);
    });

    it('nextStroke should advance one stroke', async () => {
      kaku.nextStroke();
      vi.advanceTimersByTime(500);

      expect(kaku.currentStroke).toBe(1);
    });

    it('previousStroke should go back one stroke', async () => {
      kaku.nextStroke();
      vi.advanceTimersByTime(500);
      kaku.previousStroke();

      expect(kaku.currentStroke).toBe(0);
    });
  });

  describe('events', () => {
    beforeEach(async () => {
      kaku = new Kaku({
        provider,
        container,
        animation: { strokeDuration: 0.5 },
      });
      await kaku.load('一');
    });

    it('should emit events', () => {
      const handler = vi.fn();
      kaku.on('start', handler);
      kaku.play();

      expect(handler).toHaveBeenCalledWith({ type: 'start' });
    });

    it('should return unsubscribe function', () => {
      const handler = vi.fn();
      const unsubscribe = kaku.on('start', handler);
      unsubscribe();
      kaku.play();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('getSvg', () => {
    it('should return SVG element after load', async () => {
      kaku = new Kaku({ provider, container });
      await kaku.load('一');

      const svg = kaku.getSvg();
      expect(svg.tagName).toBe('svg');
    });
  });

  describe('getCharacterData', () => {
    it('should return null before load', () => {
      kaku = new Kaku({ provider, container });

      expect(kaku.getCharacterData()).toBeNull();
    });

    it('should return character data after load', async () => {
      kaku = new Kaku({ provider, container });
      await kaku.load('一');

      const data = kaku.getCharacterData();
      expect(data?.character).toBe('一');
      expect(data?.strokes).toHaveLength(1);
    });
  });

  describe('getRenderedStrokes', () => {
    it('should return empty array before load', () => {
      kaku = new Kaku({ provider, container });

      expect(kaku.getRenderedStrokes()).toEqual([]);
    });

    it('should return one rendered stroke per stroke after load', async () => {
      provider = createMockProvider(multiStrokeData);
      kaku = new Kaku({ provider, container });
      await kaku.load('十');

      expect(kaku.getRenderedStrokes()).toHaveLength(2);
    });

    it('should satisfy the RenderedStroke contract KakuRen depends on', async () => {
      kaku = new Kaku({ provider, container });
      await kaku.load('一');

      const [rendered] = kaku.getRenderedStrokes();

      expect(rendered.element.tagName).toBe('path');
      expect(rendered.length).toBeGreaterThan(0);
      expect(rendered.stroke.pathData).toBe(mockCharacterData.strokes[0].pathData);
      for (const method of [
        'setProgress',
        'setTransition',
        'clearTransition',
        'setOpacity',
        'setOpacityTransition',
        'clearOpacityTransition',
      ] as const) {
        expect(typeof rendered[method]).toBe('function');
      }
    });

    it('should return live objects that drive the DOM', async () => {
      kaku = new Kaku({ provider, container });
      await kaku.load('一');

      const [rendered] = kaku.getRenderedStrokes();
      rendered.setProgress(1);

      expect(container.querySelector('path')?.style.strokeDashoffset).toBe('0');
    });

    it('should return the strokes for the current character after reload', async () => {
      provider = createMockProvider(mockCharacterData);
      kaku = new Kaku({ provider, container });
      await kaku.load('一');
      expect(kaku.getRenderedStrokes()).toHaveLength(1);

      kaku = new Kaku({ provider: createMockProvider(multiStrokeData), container });
      await kaku.load('十');

      expect(kaku.getRenderedStrokes()).toHaveLength(2);
    });

    it('should return empty array after dispose', async () => {
      kaku = new Kaku({ provider, container });
      await kaku.load('一');
      kaku.dispose();

      expect(kaku.getRenderedStrokes()).toEqual([]);
    });
  });

  describe('setShowOutline', () => {
    it('should add the outline overlay to a loaded character', async () => {
      kaku = new Kaku({ provider, container });
      await kaku.load('一');
      expect(container.querySelectorAll('path')).toHaveLength(1);

      kaku.setShowOutline(true);

      // Outline copy + animated copy
      expect(container.querySelectorAll('path')).toHaveLength(2);
    });

    it('should remove the outline overlay again', async () => {
      kaku = new Kaku({ provider, container, showOutline: true });
      await kaku.load('一');
      expect(container.querySelectorAll('path')).toHaveLength(2);

      kaku.setShowOutline(false);

      expect(container.querySelectorAll('path')).toHaveLength(1);
    });

    it('should preserve other render options', async () => {
      kaku = new Kaku({
        provider,
        container,
        strokeColor: '#ff0000',
        strokeWidth: 5,
        showGrid: true,
      });
      await kaku.load('一');

      kaku.setShowOutline(true);

      const paths = Array.from(container.querySelectorAll('path'));
      const animated = paths[paths.length - 1];
      expect(animated.getAttribute('stroke')).toBe('#ff0000');
      expect(animated.getAttribute('stroke-width')).toBe('5');
      expect(container.querySelectorAll('line')).toHaveLength(2);
    });

    it('should use the configured outline color', async () => {
      kaku = new Kaku({ provider, container, outlineColor: '#eee' });
      await kaku.load('一');

      kaku.setShowOutline(true);

      const outline = container.querySelectorAll('path')[0];
      expect(outline.getAttribute('stroke')).toBe('#eee');
    });

    it('should reset animation state back to the first stroke', async () => {
      provider = createMockProvider(multiStrokeData);
      kaku = new Kaku({ provider, container, animation: { strokeDuration: 0.5 } });
      await kaku.load('十');

      kaku.nextStroke();
      await vi.advanceTimersByTimeAsync(500);
      expect(kaku.currentStroke).toBe(1);

      kaku.setShowOutline(true);

      expect(kaku.currentStroke).toBe(0);
      expect(kaku.state).toBe('idle');
    });

    it('should hand the animator the newly rendered strokes', async () => {
      kaku = new Kaku({ provider, container });
      await kaku.load('一');
      const before = kaku.getRenderedStrokes()[0];

      kaku.setShowOutline(true);
      const after = kaku.getRenderedStrokes()[0];

      // Re-rendering replaces the DOM, so stale stroke objects would point at
      // detached elements the animator can no longer drive.
      expect(after).not.toBe(before);
      expect(after.element.isConnected).toBe(true);
      expect(before.element.isConnected).toBe(false);
    });

    it('should be a no-op before a character is loaded', () => {
      kaku = new Kaku({ provider, container });

      expect(() => kaku.setShowOutline(true)).not.toThrow();
      expect(container.querySelector('svg')).toBeNull();
    });

    it('should apply a pre-load setting to the next loaded character', async () => {
      kaku = new Kaku({ provider, container });
      kaku.setShowOutline(true);

      await kaku.load('一');

      expect(container.querySelectorAll('path')).toHaveLength(2);
    });
  });

  describe('dispose', () => {
    it('should clean up resources', async () => {
      kaku = new Kaku({ provider, container });
      await kaku.load('一');
      kaku.dispose();

      expect(container.querySelector('svg')).toBeNull();
      expect(kaku.getCharacterData()).toBeNull();
    });

    it('should be safe to call multiple times', () => {
      kaku = new Kaku({ provider, container });
      kaku.dispose();
      kaku.dispose();

      // No error thrown
    });
  });

  describe('dimensions', () => {
    it('should apply custom width and height', async () => {
      kaku = new Kaku({
        provider,
        container,
        width: 300,
        height: 300,
      });
      await kaku.load('一');

      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('width')).toBe('300');
      expect(svg?.getAttribute('height')).toBe('300');
    });
  });

  describe('autoplay', () => {
    it('should autoplay when option is set', async () => {
      kaku = new Kaku({
        provider,
        container,
        animation: { autoplay: true },
      });
      await kaku.load('一');

      expect(kaku.state).toBe('playing');
    });
  });
});
