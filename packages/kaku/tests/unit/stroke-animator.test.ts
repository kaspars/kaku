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
      setOpacity: vi.fn(),
      setOpacityTransition: vi.fn(),
      clearOpacityTransition: vi.fn(),
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

    it('should restart when play is called after completion', async () => {
      animator.play();
      await vi.advanceTimersByTimeAsync(1500);
      expect(animator.state).toBe('completed');

      animator.play();

      expect(animator.state).toBe('playing');
      expect(animator.currentStroke).toBe(0);
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

    it('should complete current stroke instantly on rapid clicks', async () => {
      animator.nextStroke();
      // Click again before animation completes
      animator.nextStroke();

      // First stroke should be completed instantly (setProgress(1) twice: once for animation, once for instant finish)
      expect(strokes[0].setProgress).toHaveBeenCalledWith(1);
      // Second stroke should start animating
      expect(strokes[1].setProgress).toHaveBeenCalledWith(1);
      // Current stroke should be 1 (first completed, second animating)
      expect(animator.currentStroke).toBe(1);
    });

    it('should handle multiple rapid clicks correctly', async () => {
      // Rapid fire 3 clicks
      animator.nextStroke();
      animator.nextStroke();
      animator.nextStroke();

      // All 3 strokes should have been set to visible
      expect(strokes[0].setProgress).toHaveBeenCalledWith(1);
      expect(strokes[1].setProgress).toHaveBeenCalledWith(1);
      expect(strokes[2].setProgress).toHaveBeenCalledWith(1);
      // Current stroke should be 2 (animating the third)
      expect(animator.currentStroke).toBe(2);
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

    it('should cancel animation without hiding extra stroke', async () => {
      // Advance to stroke 2
      animator.nextStroke();
      await vi.advanceTimersByTimeAsync(500);
      animator.nextStroke();
      await vi.advanceTimersByTimeAsync(500);
      expect(animator.currentStroke).toBe(2);

      // Start animating stroke 2 (index 2)
      animator.nextStroke();
      // Go back while stroke 2 is animating - should only cancel stroke 2
      animator.previousStroke();

      // Still at stroke 2 (cancel counts as the go-back)
      expect(animator.currentStroke).toBe(2);
      // Stroke at index 2 should be hidden (cancelled)
      expect(strokes[2].setProgress).toHaveBeenCalledWith(0);
    });

    it('should go back normally after cancel', async () => {
      // Advance to stroke 2
      animator.nextStroke();
      await vi.advanceTimersByTimeAsync(500);
      animator.nextStroke();
      await vi.advanceTimersByTimeAsync(500);

      // Start animating stroke 2, then cancel
      animator.nextStroke();
      animator.previousStroke(); // cancels, stays at 2
      animator.previousStroke(); // now goes back to 1

      expect(animator.currentStroke).toBe(1);
      expect(strokes[1].setProgress).toHaveBeenCalledWith(0);
    });

    it('should pause and handle state correctly when called during playback', async () => {
      animator.play();

      // Finish stroke 0
      await vi.advanceTimersByTimeAsync(500);
      expect(animator.currentStroke).toBe(1);

      // Stroke 1 starts animating...
      // Call previousStroke while stroke 1 is animating
      animator.previousStroke();

      // Expectation: Animation should pause
      expect(animator.state).toBe('paused');

      // Expectation: currentStroke should be 1 (cancel counts as go-back)
      expect(animator.currentStroke).toBe(1);

      // Stroke 1 should be hidden (cancelled)
      expect(strokes[1].setProgress).toHaveBeenCalledWith(0);

      // Finish stroke 1 animation duration (if it was still running)
      await vi.advanceTimersByTimeAsync(500);

      // Expectation: No ghost jump to stroke 2
      expect(animator.currentStroke).toBe(1); // Should stay at 1

      // Expectation: Stroke 2 should NOT have started
      expect(strokes[2].setProgress).not.toHaveBeenCalled();
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
      // Plus extra to trigger the two-phase loop delay (reset + pause + play)
      await vi.advanceTimersByTimeAsync(1502);

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

      await vi.advanceTimersByTimeAsync(500); // First half of delay
      expect(resetHandler).toHaveBeenCalled(); // Reset fires mid-delay

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

  describe('strokeEffect option', () => {
    it('should use draw effect by default', () => {
      animator.setStrokes(strokes);

      // Transitions should be set for draw effect
      for (const stroke of strokes) {
        expect(stroke.setTransition).toHaveBeenCalledWith(0.5, 'ease');
      }
    });

    it('should not set draw transitions when effect is none', () => {
      const noneEffectAnimator = new StrokeAnimator({
        strokeDuration: 0.5,
        strokeEffect: 'none',
      });
      noneEffectAnimator.setStrokes(strokes);

      // No transitions should be set
      for (const stroke of strokes) {
        expect(stroke.setTransition).not.toHaveBeenCalled();
        expect(stroke.setOpacityTransition).not.toHaveBeenCalled();
      }

      noneEffectAnimator.dispose();
    });

    it('should use opacity for fade effect', () => {
      const fadeAnimator = new StrokeAnimator({
        strokeDuration: 0.5,
        strokeEffect: 'fade',
      });
      fadeAnimator.setStrokes(strokes);

      // Opacity transitions should be set
      for (const stroke of strokes) {
        expect(stroke.setProgress).toHaveBeenCalledWith(1); // Full path visible
        expect(stroke.setOpacity).toHaveBeenCalledWith(0); // But invisible
        expect(stroke.setOpacityTransition).toHaveBeenCalledWith(0.5, 'ease');
      }

      fadeAnimator.dispose();
    });

    it('should show strokes instantly with none effect', async () => {
      const noneEffectAnimator = new StrokeAnimator({
        strokeDuration: 0.5,
        strokeEffect: 'none',
      });
      noneEffectAnimator.setStrokes(strokes);
      noneEffectAnimator.play();

      // First stroke should be shown
      expect(strokes[0].setProgress).toHaveBeenCalledWith(1);

      // After duration, next stroke should be shown
      await vi.advanceTimersByTimeAsync(500);
      expect(strokes[1].setProgress).toHaveBeenCalledWith(1);

      noneEffectAnimator.dispose();
    });

    it('should respect strokeDuration delay even with none effect', async () => {
      const noneEffectAnimator = new StrokeAnimator({
        strokeDuration: 0.5,
        strokeEffect: 'none',
      });
      noneEffectAnimator.setStrokes(strokes);
      noneEffectAnimator.play();

      // Second stroke should not be shown yet
      expect(strokes[1].setProgress).not.toHaveBeenCalled();

      // After half the duration, still waiting
      await vi.advanceTimersByTimeAsync(250);
      expect(strokes[1].setProgress).not.toHaveBeenCalled();

      // After full duration, second stroke shown
      await vi.advanceTimersByTimeAsync(250);
      expect(strokes[1].setProgress).toHaveBeenCalledWith(1);

      noneEffectAnimator.dispose();
    });

    it('should animate fade effect using opacity', async () => {
      const fadeAnimator = new StrokeAnimator({
        strokeDuration: 0.5,
        strokeEffect: 'fade',
      });
      fadeAnimator.setStrokes(strokes);
      fadeAnimator.play();

      // First stroke should be faded in
      expect(strokes[0].setOpacity).toHaveBeenCalledWith(1);

      // After duration, next stroke should fade in
      await vi.advanceTimersByTimeAsync(500);
      expect(strokes[1].setOpacity).toHaveBeenCalledWith(1);

      fadeAnimator.dispose();
    });

    it('should emit events normally with all effects', async () => {
      const noneEffectAnimator = new StrokeAnimator({
        strokeDuration: 0.5,
        strokeEffect: 'none',
      });
      noneEffectAnimator.setStrokes(strokes);

      const startHandler = vi.fn();
      const strokeStartHandler = vi.fn();
      const strokeCompleteHandler = vi.fn();
      const completeHandler = vi.fn();

      noneEffectAnimator.on('start', startHandler);
      noneEffectAnimator.on('strokeStart', strokeStartHandler);
      noneEffectAnimator.on('strokeComplete', strokeCompleteHandler);
      noneEffectAnimator.on('complete', completeHandler);

      noneEffectAnimator.play();
      expect(startHandler).toHaveBeenCalled();
      expect(strokeStartHandler).toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1500);
      expect(strokeCompleteHandler).toHaveBeenCalledTimes(3);
      expect(completeHandler).toHaveBeenCalled();

      noneEffectAnimator.dispose();
    });
  });

  describe('manual stepping with fade effect', () => {
    let fadeAnimator: StrokeAnimator;

    beforeEach(() => {
      fadeAnimator = new StrokeAnimator({
        strokeDuration: 0.5,
        strokeEffect: 'fade',
      });
      fadeAnimator.setStrokes(strokes);
      // setStrokes primes every stroke (setProgress(1) + setOpacity(0)); clear
      // so the assertions below only see the stepping behaviour.
      vi.clearAllMocks();
    });

    afterEach(() => {
      fadeAnimator.dispose();
    });

    it('nextStroke should complete an in-flight stroke via opacity', async () => {
      fadeAnimator.play();
      await vi.advanceTimersByTimeAsync(250); // mid-fade
      vi.clearAllMocks();

      fadeAnimator.nextStroke();

      expect(strokes[0].setOpacity).toHaveBeenCalledWith(1);
    });

    it('nextStroke should re-arm the opacity transition after the instant show', async () => {
      fadeAnimator.play();
      await vi.advanceTimersByTimeAsync(250);
      vi.clearAllMocks();

      fadeAnimator.nextStroke();

      // Transition must be cleared before the jump and restored after, or the
      // "instant" completion animates instead of snapping.
      const cleared = vi.mocked(strokes[0].clearOpacityTransition).mock
        .invocationCallOrder[0];
      const set = vi.mocked(strokes[0].setOpacity).mock.invocationCallOrder[0];
      const rearmed = vi.mocked(strokes[0].setOpacityTransition).mock
        .invocationCallOrder[0];

      expect(cleared).toBeLessThan(set);
      expect(set).toBeLessThan(rearmed);
      expect(strokes[0].setOpacityTransition).toHaveBeenCalledWith(0.5, 'ease');
    });

    it('nextStroke should advance past the completed stroke and fade the next', async () => {
      fadeAnimator.play();
      await vi.advanceTimersByTimeAsync(250);
      vi.clearAllMocks();

      fadeAnimator.nextStroke();

      expect(fadeAnimator.currentStroke).toBe(1);
      expect(strokes[1].setOpacity).toHaveBeenCalledWith(1);
    });

    it('nextStroke should not touch dashoffset when fading', async () => {
      fadeAnimator.play();
      await vi.advanceTimersByTimeAsync(250);
      vi.clearAllMocks();

      fadeAnimator.nextStroke();

      // Dispatching to the draw branch here would be silently wrong: the
      // element is already fully drawn and only opacity should move.
      expect(strokes[0].setProgress).not.toHaveBeenCalled();
      expect(strokes[0].clearTransition).not.toHaveBeenCalled();
    });

    it('previousStroke should hide an in-flight stroke via opacity', async () => {
      fadeAnimator.play();
      await vi.advanceTimersByTimeAsync(250);
      vi.clearAllMocks();

      fadeAnimator.previousStroke();

      expect(strokes[0].setOpacity).toHaveBeenCalledWith(0);
      expect(strokes[0].setProgress).not.toHaveBeenCalled();
    });

    it('previousStroke should re-arm the opacity transition after hiding', async () => {
      fadeAnimator.play();
      await vi.advanceTimersByTimeAsync(250);
      vi.clearAllMocks();

      fadeAnimator.previousStroke();

      const cleared = vi.mocked(strokes[0].clearOpacityTransition).mock
        .invocationCallOrder[0];
      const set = vi.mocked(strokes[0].setOpacity).mock.invocationCallOrder[0];
      const rearmed = vi.mocked(strokes[0].setOpacityTransition).mock
        .invocationCallOrder[0];

      expect(cleared).toBeLessThan(set);
      expect(set).toBeLessThan(rearmed);
    });

    it('previousStroke should cancel rather than step back when mid-fade', async () => {
      // Step past stroke 0 first, so cancelling and stepping back would land on
      // different indices — at index 0 the two are indistinguishable.
      const step = fadeAnimator.nextStroke();
      await vi.advanceTimersByTimeAsync(500);
      await step;
      expect(fadeAnimator.currentStroke).toBe(1);

      fadeAnimator.play();
      await vi.advanceTimersByTimeAsync(250); // stroke 1 mid-fade
      vi.clearAllMocks();

      fadeAnimator.previousStroke();

      // The cancel *is* the step back: stroke 1 is hidden and the index holds,
      // rather than decrementing and hiding stroke 0 as well.
      expect(fadeAnimator.currentStroke).toBe(1);
      expect(strokes[1].setOpacity).toHaveBeenCalledWith(0);
      expect(strokes[0].setOpacity).not.toHaveBeenCalled();
    });

    it('previousStroke should hide the prior stroke when nothing is animating', async () => {
      // Don't await nextStroke() before advancing — its promise only settles
      // once the stroke timer fires, which fake timers hold back.
      const step = fadeAnimator.nextStroke();
      await vi.advanceTimersByTimeAsync(500);
      await step;
      expect(fadeAnimator.currentStroke).toBe(1);
      vi.clearAllMocks();

      fadeAnimator.previousStroke();

      expect(fadeAnimator.currentStroke).toBe(0);
      expect(strokes[0].setOpacity).toHaveBeenCalledWith(0);
      expect(strokes[0].setProgress).not.toHaveBeenCalled();
    });
  });

  describe('manual stepping with none effect', () => {
    let noneAnimator: StrokeAnimator;

    beforeEach(() => {
      noneAnimator = new StrokeAnimator({
        strokeDuration: 0.5,
        strokeEffect: 'none',
      });
      noneAnimator.setStrokes(strokes);
      vi.clearAllMocks();
    });

    afterEach(() => {
      noneAnimator.dispose();
    });

    it('nextStroke should complete an in-flight stroke via progress', async () => {
      noneAnimator.play();
      await vi.advanceTimersByTimeAsync(250); // inside the stroke's time slot
      vi.clearAllMocks();

      noneAnimator.nextStroke();

      expect(strokes[0].setProgress).toHaveBeenCalledWith(1);
    });

    it('nextStroke should not touch transitions when effect is none', async () => {
      noneAnimator.play();
      await vi.advanceTimersByTimeAsync(250);
      vi.clearAllMocks();

      noneAnimator.nextStroke();

      // The whole point of 'none' is that no transition is ever installed;
      // falling through to the draw or fade branch would install one.
      expect(strokes[0].clearTransition).not.toHaveBeenCalled();
      expect(strokes[0].setTransition).not.toHaveBeenCalled();
      expect(strokes[0].setOpacity).not.toHaveBeenCalled();
      expect(strokes[0].setOpacityTransition).not.toHaveBeenCalled();
    });

    it('nextStroke should advance past the completed stroke and show the next', async () => {
      noneAnimator.play();
      await vi.advanceTimersByTimeAsync(250);
      vi.clearAllMocks();

      noneAnimator.nextStroke();

      expect(noneAnimator.currentStroke).toBe(1);
      expect(strokes[1].setProgress).toHaveBeenCalledWith(1);
    });

    it('previousStroke should hide an in-flight stroke via progress', async () => {
      noneAnimator.play();
      await vi.advanceTimersByTimeAsync(250);
      vi.clearAllMocks();

      noneAnimator.previousStroke();

      expect(strokes[0].setProgress).toHaveBeenCalledWith(0);
      expect(strokes[0].clearTransition).not.toHaveBeenCalled();
      expect(strokes[0].setOpacity).not.toHaveBeenCalled();
    });

    it('previousStroke should cancel rather than step back when mid-slot', async () => {
      const step = noneAnimator.nextStroke();
      await vi.advanceTimersByTimeAsync(500);
      await step;
      expect(noneAnimator.currentStroke).toBe(1);

      noneAnimator.play();
      await vi.advanceTimersByTimeAsync(250);
      vi.clearAllMocks();

      noneAnimator.previousStroke();

      expect(noneAnimator.currentStroke).toBe(1);
      expect(strokes[1].setProgress).toHaveBeenCalledWith(0);
      expect(strokes[0].setProgress).not.toHaveBeenCalled();
    });

    it('previousStroke should hide the prior stroke when nothing is animating', async () => {
      const step = noneAnimator.nextStroke();
      await vi.advanceTimersByTimeAsync(500);
      await step;
      vi.clearAllMocks();

      noneAnimator.previousStroke();

      expect(noneAnimator.currentStroke).toBe(0);
      expect(strokes[0].setProgress).toHaveBeenCalledWith(0);
      expect(strokes[0].clearTransition).not.toHaveBeenCalled();
    });
  });

  describe('reset with non-default effects', () => {
    it('should hide strokes via opacity when effect is fade', async () => {
      const fadeAnimator = new StrokeAnimator({
        strokeDuration: 0.5,
        strokeEffect: 'fade',
      });
      fadeAnimator.setStrokes(strokes);
      fadeAnimator.play();
      await vi.advanceTimersByTimeAsync(500);
      vi.clearAllMocks();

      fadeAnimator.reset();

      for (const stroke of strokes) {
        expect(stroke.setOpacity).toHaveBeenCalledWith(0);
        // Cleared before the jump, restored after — same invariant as stepping
        const cleared = vi.mocked(stroke.clearOpacityTransition).mock
          .invocationCallOrder[0];
        const set = vi.mocked(stroke.setOpacity).mock.invocationCallOrder[0];
        const rearmed = vi.mocked(stroke.setOpacityTransition).mock
          .invocationCallOrder[0];
        expect(cleared).toBeLessThan(set);
        expect(set).toBeLessThan(rearmed);
        expect(stroke.setProgress).not.toHaveBeenCalled();
      }

      fadeAnimator.dispose();
    });

    it('should hide strokes via progress when effect is none', async () => {
      const noneAnimator = new StrokeAnimator({
        strokeDuration: 0.5,
        strokeEffect: 'none',
      });
      noneAnimator.setStrokes(strokes);
      noneAnimator.play();
      await vi.advanceTimersByTimeAsync(500);
      vi.clearAllMocks();

      noneAnimator.reset();

      for (const stroke of strokes) {
        expect(stroke.setProgress).toHaveBeenCalledWith(0);
        expect(stroke.clearTransition).not.toHaveBeenCalled();
        expect(stroke.setTransition).not.toHaveBeenCalled();
        expect(stroke.setOpacity).not.toHaveBeenCalled();
      }

      noneAnimator.dispose();
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
