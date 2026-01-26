import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Kaku, KanjiVGProvider } from '../../src/index';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load fixture
const fixturePath = resolve(__dirname, '../fixtures/kanjivg-05978.svg');
const fixtureContent = readFileSync(fixturePath, 'utf-8');

describe('Kaku Integration', () => {
  let container: HTMLDivElement;
  let mockFetch: ReturnType<typeof vi.fn>;
  let kaku: Kaku;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);

    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(fixtureContent),
    });
  });

  afterEach(() => {
    kaku?.dispose();
    vi.useRealTimers();
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('should load and animate character end-to-end', async () => {
    const provider = new KanjiVGProvider({
      basePath: 'https://example.com/kanjivg',
      fetch: mockFetch,
    });

    kaku = new Kaku({
      provider,
      container,
      animation: { strokeDuration: 0.5 },
    });

    // Load character
    await kaku.load('奸');

    expect(kaku.character).toBe('奸');
    expect(kaku.totalStrokes).toBe(6);
    expect(kaku.state).toBe('idle');

    // Verify SVG rendered
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 109 109');

    // Verify strokes rendered
    const paths = container.querySelectorAll('path');
    expect(paths).toHaveLength(6);

    // Test animation
    const events: string[] = [];
    kaku.on('start', () => events.push('start'));
    kaku.on('strokeStart', (e) => events.push(`strokeStart:${e.strokeIndex}`));
    kaku.on('strokeComplete', (e) => events.push(`strokeComplete:${e.strokeIndex}`));
    kaku.on('complete', () => events.push('complete'));

    kaku.play();
    expect(kaku.state).toBe('playing');
    expect(events).toContain('start');
    expect(events).toContain('strokeStart:0');

    // Complete all strokes
    await vi.advanceTimersByTimeAsync(3000); // 6 strokes * 500ms

    expect(kaku.state).toBe('completed');
    expect(events).toContain('complete');
    expect(events.filter((e) => e.startsWith('strokeComplete'))).toHaveLength(6);
  });

  it('should support manual stroke-by-stroke animation', async () => {
    const provider = new KanjiVGProvider({
      basePath: 'https://example.com/kanjivg',
      fetch: mockFetch,
    });

    kaku = new Kaku({
      provider,
      container,
      animation: { strokeDuration: 0.3 },
    });

    await kaku.load('奸');

    // Advance through strokes manually
    expect(kaku.currentStroke).toBe(0);

    kaku.nextStroke();
    await vi.advanceTimersByTimeAsync(300);
    expect(kaku.currentStroke).toBe(1);

    kaku.nextStroke();
    await vi.advanceTimersByTimeAsync(300);
    expect(kaku.currentStroke).toBe(2);

    // Go back
    kaku.previousStroke();
    expect(kaku.currentStroke).toBe(1);

    // Reset
    kaku.reset();
    expect(kaku.currentStroke).toBe(0);
    expect(kaku.state).toBe('idle');
  });

  it('should support custom styling', async () => {
    const provider = new KanjiVGProvider({
      basePath: 'https://example.com/kanjivg',
      fetch: mockFetch,
    });

    kaku = new Kaku({
      provider,
      container,
      width: 300,
      height: 300,
      strokeColor: '#ff0000',
      strokeWidth: 5,
      showGrid: true,
      gridColor: '#cccccc',
    });

    await kaku.load('奸');

    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('300');
    expect(svg?.getAttribute('height')).toBe('300');

    const paths = container.querySelectorAll('path');
    expect(paths[0].getAttribute('stroke')).toBe('#ff0000');
    expect(paths[0].getAttribute('stroke-width')).toBe('5');

    const lines = container.querySelectorAll('line');
    expect(lines).toHaveLength(2);
    expect(lines[0].getAttribute('stroke')).toBe('#cccccc');
  });

  it('should support looping animation', async () => {
    const provider = new KanjiVGProvider({
      basePath: 'https://example.com/kanjivg',
      fetch: mockFetch,
    });

    kaku = new Kaku({
      provider,
      container,
      animation: {
        strokeDuration: 0.1,
        loop: true,
        loopDelay: 0.1,
      },
    });

    await kaku.load('奸');

    let completeCount = 0;
    kaku.on('complete', () => completeCount++);

    kaku.play();

    // Complete first loop
    await vi.advanceTimersByTimeAsync(600); // 6 strokes * 100ms
    expect(completeCount).toBe(1);

    // Wait for loop delay and start of second loop
    await vi.advanceTimersByTimeAsync(700); // 100ms delay + 600ms animation
    expect(completeCount).toBe(2);
  });

  it('should handle autoplay', async () => {
    const provider = new KanjiVGProvider({
      basePath: 'https://example.com/kanjivg',
      fetch: mockFetch,
    });

    kaku = new Kaku({
      provider,
      container,
      animation: {
        strokeDuration: 0.5,
        autoplay: true,
      },
    });

    await kaku.load('奸');

    expect(kaku.state).toBe('playing');
  });

  it('should handle pause and resume', async () => {
    const provider = new KanjiVGProvider({
      basePath: 'https://example.com/kanjivg',
      fetch: mockFetch,
    });

    kaku = new Kaku({
      provider,
      container,
      animation: { strokeDuration: 0.5 },
    });

    await kaku.load('奸');

    const events: string[] = [];
    kaku.on('pause', () => events.push('pause'));
    kaku.on('resume', () => events.push('resume'));

    kaku.play();
    await vi.advanceTimersByTimeAsync(500);
    expect(kaku.currentStroke).toBe(1);

    kaku.pause();
    expect(kaku.state).toBe('paused');
    expect(events).toContain('pause');

    // Verify animation is paused
    await vi.advanceTimersByTimeAsync(1000);
    expect(kaku.currentStroke).toBe(1);

    kaku.play();
    expect(kaku.state).toBe('playing');
    expect(events).toContain('resume');

    await vi.advanceTimersByTimeAsync(500);
    expect(kaku.currentStroke).toBe(2);
  });

  it('should expose character data', async () => {
    const provider = new KanjiVGProvider({
      basePath: 'https://example.com/kanjivg',
      fetch: mockFetch,
    });

    kaku = new Kaku({ provider, container });
    await kaku.load('奸');

    const data = kaku.getCharacterData();
    expect(data).not.toBeNull();
    expect(data?.character).toBe('奸');
    expect(data?.codePoints).toEqual([0x5978]);
    expect(data?.strokes).toHaveLength(6);
    expect(data?.strokes[0].metadata.type).toBe('㇛');
  });
});
