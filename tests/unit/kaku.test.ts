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
