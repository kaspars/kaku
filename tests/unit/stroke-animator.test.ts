import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StrokeAnimator } from '../../src/animator/stroke-animator';
import type { RenderedStroke, Stroke } from '../../src/types';

// Helper to create mock rendered strokes
function createMockStrokes(count: number): RenderedStroke[] {
  return Array.from({ length: count }, (_, i) => {
    const element = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path'
    );
    element.setAttribute('d', `M${i * 10},0 L${i * 10 + 10},10`);
    document.body.appendChild(element);

    const mockStroke: Stroke = {
      pathData: `M${i * 10},0 L${i * 10 + 10},10`,
      metadata: { index: i },
    };

    return {
      element,
      length: 14.14,
      stroke: mockStroke,
      setProgress: vi.fn(),
      setTransition: vi.fn(),
      clearTransition: vi.fn(),
    } as RenderedStroke;
  });
}

describe('StrokeAnimator', () => {
  let animator: StrokeAnimator;
  let strokes: RenderedStroke[];

  beforeEach(() => {
    vi.useFakeTimers();
    animator = new StrokeAnimator({ strokeDuration: 0.5 });
    strokes = createMockStrokes(3);
  });

  afterEach(() => {
    animator.dispose();
    vi.useRealTimers();
    // Clean up mock elements
    document.body.innerHTML = '';
  });

  describe('initial state', () => {
    it('should start in idle state', () => {
      expect(animator.state).toBe('idle');
    });

    it('should have currentStroke at 0', () => {
      expect(animator.currentStroke).toBe(0);
    });

    it('should have totalStrokes at 0 before setStrokes', () => {
      expect(animator.totalStrokes).toBe(0);
    });
  });

  describe('setStrokes', () => {
    it('should set totalStrokes', () => {
      animator.setStrokes(strokes);
      expect(animator.totalStrokes).toBe(3);
    });

    it('should setup transitions on strokes', () => {
      animator.setStrokes(strokes);

      for (const stroke of strokes) {
        expect(stroke.setTransition).toHaveBeenCalledWith(0.5, 'ease');
      }
    });

    it('should reset state when called again', async () => {
      animator.setStrokes(strokes);
      animator.play();
      await vi.advanceTimersByTimeAsync(500);

      animator.setStrokes(strokes);
      expect(animator.state).toBe('idle');
      expect(animator.currentStroke).toBe(0);
    });

    it('should autoplay when option is set', () => {
      const autoplayAnimator = new StrokeAnimator({
        strokeDuration: 0.5,
        autoplay: true,
      });
      autoplayAnimator.setStrokes(strokes);

      expect(autoplayAnimator.state).toBe('playing');
      autoplayAnimator.dispose();
    });
  });

  describe('play', () => {
    beforeEach(() => {
      animator.setStrokes(strokes);
    });

    it('should change state to playing', () => {
      animator.play();
      expect(animator.state).toBe('playing');
    });

    it('should emit start event', () => {
      const handler = vi.fn();
      animator.on('start', handler);
      animator.play();

      expect(handler).toHaveBeenCalledWith({ type: 'start' });
    });

    it('should emit strokeStart event', () => {
      const handler = vi.fn();
      animator.on('strokeStart', handler);
      animator.play();

      expect(handler).toHaveBeenCalledWith({
        type: 'strokeStart',
        strokeIndex: 0,
        totalStrokes: 3,
      });
    });

    it('should animate strokes in sequence', async () => {
      animator.play();

      // First stroke starts immediately
      expect(strokes[0].setProgress).toHaveBeenCalledWith(1);

      // After first stroke duration
      await vi.advanceTimersByTimeAsync(500);
      expect(strokes[1].setProgress).toHaveBeenCalledWith(1);

      // After second stroke duration
      await vi.advanceTimersByTimeAsync(500);
      expect(strokes[2].setProgress).toHaveBeenCalledWith(1);
    });

    it('should emit strokeComplete events', async () => {
      const handler = vi.fn();
      animator.on('strokeComplete', handler);
      animator.play();

      await vi.advanceTimersByTimeAsync(500);
      expect(handler).toHaveBeenCalledWith({
        type: 'strokeComplete',
        strokeIndex: 0,
        totalStrokes: 3,
      });
    });

    it('should emit complete event when done', async () => {
      const handler = vi.fn();
      animator.on('complete', handler);
      animator.play();

      await vi.advanceTimersByTimeAsync(1500);
      expect(handler).toHaveBeenCalledWith({
        type: 'complete',
        totalStrokes: 3,
      });
    });

    it('should change to completed state when done', async () => {
      animator.play();
      await vi.advanceTimersByTimeAsync(1500);

      expect(animator.state).toBe('completed');
    });

    it('should not restart if already playing', () => {
      const handler = vi.fn();
      animator.on('start', handler);

      animator.play();
      animator.play();

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should do nothing if no strokes', () => {
      const emptyAnimator = new StrokeAnimator();
      emptyAnimator.play();

      expect(emptyAnimator.state).toBe('idle');
    });
  });

  describe('pause', () => {
    beforeEach(() => {
      animator.setStrokes(strokes);
    });

    it('should change state to paused', () => {
      animator.play();
      animator.pause();

      expect(animator.state).toBe('paused');
    });

    it('should emit pause event', () => {
      const handler = vi.fn();
      animator.on('pause', handler);

      animator.play();
      animator.pause();

      expect(handler).toHaveBeenCalledWith({ type: 'pause' });
    });

    it('should stop animation progression', async () => {
      animator.play();
      await vi.advanceTimersByTimeAsync(250); // Halfway through first stroke
      animator.pause();

      await vi.advanceTimersByTimeAsync(1000);

      // Second stroke should not have started
      expect(strokes[1].setProgress).not.toHaveBeenCalled();
    });

    it('should do nothing if not playing', () => {
      const handler = vi.fn();
      animator.on('pause', handler);

      animator.pause();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('resume (play after pause)', () => {
    beforeEach(() => {
      animator.setStrokes(strokes);
    });

    it('should emit resume event', async () => {
      const handler = vi.fn();
      animator.on('resume', handler);

      animator.play();
      await vi.advanceTimersByTimeAsync(500);
      animator.pause();
      animator.play();

      expect(handler).toHaveBeenCalledWith({ type: 'resume' });
    });
  });

  describe('reset', () => {
    beforeEach(() => {
      animator.setStrokes(strokes);
    });

    it('should change state to idle', async () => {
      animator.play();
      await vi.advanceTimersByTimeAsync(500);
      animator.reset();

      expect(animator.state).toBe('idle');
    });

    it('should reset currentStroke to 0', async () => {
      animator.play();
      await vi.advanceTimersByTimeAsync(500);
      animator.reset();

      expect(animator.currentStroke).toBe(0);
    });

    it('should reset all strokes to hidden', async () => {
      animator.play();
      await vi.advanceTimersByTimeAsync(500);
      animator.reset();

      for (const stroke of strokes) {
        expect(stroke.clearTransition).toHaveBeenCalled();
        expect(stroke.setProgress).toHaveBeenCalledWith(0);
      }
    });

    it('should emit reset event', () => {
      const handler = vi.fn();
      animator.on('reset', handler);

      animator.play();
      animator.reset();

      expect(handler).toHaveBeenCalledWith({ type: 'reset' });
    });
  });

  describe('nextStroke (manual mode)', () => {
    beforeEach(() => {
      animator.setStrokes(strokes);
    });

    it('should animate single stroke', async () => {
      animator.nextStroke();

      expect(strokes[0].setProgress).toHaveBeenCalledWith(1);
    });

    it('should advance currentStroke after animation', async () => {
      animator.nextStroke();
      await vi.advanceTimersByTimeAsync(500);

      expect(animator.currentStroke).toBe(1);
    });

    it('should emit strokeStart and strokeComplete', async () => {
      const startHandler = vi.fn();
      const completeHandler = vi.fn();
      animator.on('strokeStart', startHandler);
      animator.on('strokeComplete', completeHandler);

      animator.nextStroke();
      await vi.advanceTimersByTimeAsync(500);

      expect(startHandler).toHaveBeenCalled();
      expect(completeHandler).toHaveBeenCalled();
    });

    it('should not animate while stroke is in progress', async () => {
      animator.nextStroke();
      animator.nextStroke();

      // Only first stroke should be animated
      expect(strokes[0].setProgress).toHaveBeenCalledTimes(1);
      expect(strokes[1].setProgress).not.toHaveBeenCalled();
    });

    it('should do nothing when all strokes complete', async () => {
      animator.nextStroke();
      await vi.advanceTimersByTimeAsync(500);
      animator.nextStroke();
      await vi.advanceTimersByTimeAsync(500);
      animator.nextStroke();
      await vi.advanceTimersByTimeAsync(500);

      const resetSpy = vi.fn();
      animator.on('reset', resetSpy);

      await animator.nextStroke();

      expect(resetSpy).not.toHaveBeenCalled();
    });
  });

  describe('previousStroke', () => {
    beforeEach(() => {
      animator.setStrokes(strokes);
    });

    it('should go back one stroke', async () => {
      animator.nextStroke();
      await vi.advanceTimersByTimeAsync(500);
      animator.nextStroke();
      await vi.advanceTimersByTimeAsync(500);

      animator.previousStroke();

      expect(animator.currentStroke).toBe(1);
    });

    it('should hide the stroke', async () => {
      animator.nextStroke();
      await vi.advanceTimersByTimeAsync(500);

      animator.previousStroke();

      expect(strokes[0].clearTransition).toHaveBeenCalled();
      expect(strokes[0].setProgress).toHaveBeenCalledWith(0);
    });

    it('should do nothing at stroke 0', () => {
      animator.previousStroke();

      expect(animator.currentStroke).toBe(0);
    });
  });

  describe('loop option', () => {
    it('should loop when complete', async () => {
      const loopAnimator = new StrokeAnimator({
        strokeDuration: 0.5,
        loop: true,
        loopDelay: 0,
      });
      loopAnimator.setStrokes(strokes);

      const resetHandler = vi.fn();
      loopAnimator.on('reset', resetHandler);

      loopAnimator.play();
      // Complete animation (3 strokes * 500ms = 1500ms)
      // Plus tiny extra to trigger the 0ms delay timeout
      await vi.advanceTimersByTimeAsync(1501);

      expect(resetHandler).toHaveBeenCalled();
      expect(loopAnimator.state).toBe('playing');

      loopAnimator.dispose();
    });

    it('should respect loopDelay', async () => {
      const loopAnimator = new StrokeAnimator({
        strokeDuration: 0.5,
        loop: true,
        loopDelay: 1,
      });
      loopAnimator.setStrokes(strokes);

      const resetHandler = vi.fn();
      loopAnimator.on('reset', resetHandler);

      loopAnimator.play();
      await vi.advanceTimersByTimeAsync(1500); // Complete animation

      expect(resetHandler).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1000); // Wait for delay

      expect(resetHandler).toHaveBeenCalled();

      loopAnimator.dispose();
    });

    it('should loop on nextStroke when all complete', async () => {
      const loopAnimator = new StrokeAnimator({
        strokeDuration: 0.5,
        loop: true,
      });
      loopAnimator.setStrokes(strokes);

      // Complete all strokes manually
      loopAnimator.nextStroke();
      await vi.advanceTimersByTimeAsync(500);
      loopAnimator.nextStroke();
      await vi.advanceTimersByTimeAsync(500);
      loopAnimator.nextStroke();
      await vi.advanceTimersByTimeAsync(500);

      const resetHandler = vi.fn();
      loopAnimator.on('reset', resetHandler);

      loopAnimator.nextStroke();

      expect(resetHandler).toHaveBeenCalled();

      loopAnimator.dispose();
    });
  });

  describe('event subscription', () => {
    it('should return unsubscribe function', () => {
      animator.setStrokes(strokes);
      const handler = vi.fn();
      const unsubscribe = animator.on('start', handler);

      unsubscribe();
      animator.play();

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle multiple listeners for same event', () => {
      animator.setStrokes(strokes);
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      animator.on('start', handler1);
      animator.on('start', handler2);
      animator.play();

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should catch errors in handlers', () => {
      animator.setStrokes(strokes);
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const badHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const goodHandler = vi.fn();

      animator.on('start', badHandler);
      animator.on('start', goodHandler);
      animator.play();

      expect(consoleError).toHaveBeenCalled();
      expect(goodHandler).toHaveBeenCalled();

      consoleError.mockRestore();
    });
  });

  describe('dispose', () => {
    it('should clear all state', () => {
      animator.setStrokes(strokes);
      animator.play();
      animator.dispose();

      expect(animator.state).toBe('idle');
      expect(animator.totalStrokes).toBe(0);
      expect(animator.currentStroke).toBe(0);
    });

    it('should clear event listeners', () => {
      animator.setStrokes(strokes);
      const handler = vi.fn();
      animator.on('start', handler);
      animator.dispose();

      animator.setStrokes(strokes);
      animator.play();

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
