import type {
  Animator,
  AnimatorOptions,
  AnimationState,
  AnimationEvent,
  AnimationEventType,
  AnimationEventHandler,
  RenderedStroke,
  StrokeEffect,
} from '../types/index.js';

/**
 * CSS transition-based stroke animator
 */
export class StrokeAnimator implements Animator {
  private strokes: RenderedStroke[] = [];
  private _state: AnimationState = 'idle';
  private _currentStroke = 0;
  private listeners: Map<AnimationEventType, Set<AnimationEventHandler>> =
    new Map();
  private animationTimeout: ReturnType<typeof setTimeout> | null = null;
  private isAnimatingStroke = false;

  private readonly strokeDuration: number;
  private readonly easing: string;
  private readonly loop: boolean;
  private readonly loopDelay: number;
  private readonly autoplay: boolean;
  private readonly strokeEffect: StrokeEffect;

  constructor(options: AnimatorOptions = {}) {
    this.strokeDuration = options.strokeDuration ?? 0.5;
    this.easing = options.easing ?? 'ease';
    this.loop = options.loop ?? false;
    this.loopDelay = options.loopDelay ?? 1;
    this.autoplay = options.autoplay ?? false;
    this.strokeEffect = options.strokeEffect ?? 'draw';
  }

  get state(): AnimationState {
    return this._state;
  }

  get currentStroke(): number {
    return this._currentStroke;
  }

  get totalStrokes(): number {
    return this.strokes.length;
  }

  /**
   * Get the rendered stroke objects
   */
  getStrokes(): RenderedStroke[] {
    return this.strokes;
  }

  /**
   * Initialize with rendered strokes
   */
  setStrokes(strokes: RenderedStroke[]): void {
    this.clearAnimationTimeout();
    this.strokes = strokes;
    this._currentStroke = 0;
    this._state = 'idle';
    this.isAnimatingStroke = false;

    // Setup strokes based on effect type
    for (const stroke of this.strokes) {
      if (this.strokeEffect === 'draw') {
        // Strokes start hidden via dashoffset, with transition
        stroke.setTransition(this.strokeDuration, this.easing);
      } else if (this.strokeEffect === 'fade') {
        // Strokes start hidden via opacity, show full path
        stroke.setProgress(1); // Show full stroke path
        stroke.setOpacity(0); // But invisible
        stroke.setOpacityTransition(this.strokeDuration, this.easing);
      }
      // 'none': strokes stay as initialized (hidden via dashoffset, no transition)
    }

    if (this.autoplay && this.strokes.length > 0) {
      this.play();
    }
  }

  /**
   * Start or resume animation
   */
  play(): void {
    if (this.strokes.length === 0) return;
    if (this._state === 'playing') return;
    if (this._state === 'completed') {
      this.reset();
    }

    const wasIdle = this._state === 'idle';
    this._state = 'playing';

    if (wasIdle) {
      this.emit({ type: 'start' });
    } else {
      this.emit({ type: 'resume' });
    }

    this.animateNextStroke();
  }

  /**
   * Pause animation
   */
  pause(): void {
    if (this._state !== 'playing') return;

    this._state = 'paused';
    // Note: pause stops sequencing; it does not freeze an in-progress stroke.
    this.clearAnimationTimeout();
    this.isAnimatingStroke = false;
    this.emit({ type: 'pause' });
  }

  /**
   * Reset animation to beginning
   */
  reset(): void {
    this.clearAnimationTimeout();
    this._currentStroke = 0;
    this._state = 'idle';
    this.isAnimatingStroke = false;

    // Reset all strokes to hidden (instantly)
    for (const stroke of this.strokes) {
      if (this.strokeEffect === 'draw') {
        stroke.clearTransition();
        stroke.setProgress(0);
        stroke.element.getBoundingClientRect();
        stroke.setTransition(this.strokeDuration, this.easing);
      } else if (this.strokeEffect === 'fade') {
        stroke.clearOpacityTransition();
        stroke.setOpacity(0);
        stroke.element.getBoundingClientRect();
        stroke.setOpacityTransition(this.strokeDuration, this.easing);
      } else {
        // 'none': just hide instantly
        stroke.setProgress(0);
      }
    }

    this.emit({ type: 'reset' });
  }

  /**
   * Advance to next stroke (manual mode)
   */
  async nextStroke(): Promise<void> {
    // Check if animating BEFORE pausing (pause clears the flag)
    const wasAnimating = this.isAnimatingStroke;

    if (this._state === 'playing') {
      this.pause();
    }

    // If was animating, complete the current stroke instantly and advance
    if (wasAnimating) {
      this.finishCurrentStrokeInstantly();
    }

    if (this._currentStroke >= this.strokes.length) {
      if (this.loop) {
        this.reset();
      }
      return;
    }

    return this.animateStroke(this._currentStroke);
  }

  /**
   * Go back to previous stroke (manual mode)
   */
  previousStroke(): void {
    // Check if animating BEFORE pausing (pause clears the flag)
    const wasAnimating = this.isAnimatingStroke;

    if (this._state === 'playing') {
      this.pause();
    }

    // If was animating, cancel and hide the current stroke - this counts as going back
    if (wasAnimating) {
      this.cancelCurrentStroke();
      return; // Cancel itself is the "go back" action
    }

    if (this._currentStroke === 0) return;

    this._currentStroke--;
    this.hideStroke(this.strokes[this._currentStroke]);
  }

  /**
   * Instantly complete the current animating stroke
   */
  private finishCurrentStrokeInstantly(): void {
    this.clearAnimationTimeout();

    const stroke = this.strokes[this._currentStroke];
    if (stroke) {
      this.showStrokeInstantly(stroke);
    }

    this._currentStroke++;
    this.isAnimatingStroke = false;
  }

  /**
   * Cancel the current animating stroke and hide it
   */
  private cancelCurrentStroke(): void {
    this.clearAnimationTimeout();

    const stroke = this.strokes[this._currentStroke];
    if (stroke) {
      this.hideStroke(stroke);
    }

    this.isAnimatingStroke = false;
  }

  /**
   * Show a stroke instantly (no animation)
   */
  private showStrokeInstantly(stroke: RenderedStroke): void {
    if (this.strokeEffect === 'draw') {
      stroke.clearTransition();
      stroke.setProgress(1);
      stroke.element.getBoundingClientRect();
      stroke.setTransition(this.strokeDuration, this.easing);
    } else if (this.strokeEffect === 'fade') {
      stroke.clearOpacityTransition();
      stroke.setOpacity(1);
      stroke.element.getBoundingClientRect();
      stroke.setOpacityTransition(this.strokeDuration, this.easing);
    } else {
      stroke.setProgress(1);
    }
  }

  /**
   * Hide a stroke instantly (no animation)
   */
  private hideStroke(stroke: RenderedStroke): void {
    if (this.strokeEffect === 'draw') {
      stroke.clearTransition();
      stroke.setProgress(0);
      stroke.element.getBoundingClientRect();
      stroke.setTransition(this.strokeDuration, this.easing);
    } else if (this.strokeEffect === 'fade') {
      stroke.clearOpacityTransition();
      stroke.setOpacity(0);
      stroke.element.getBoundingClientRect();
      stroke.setOpacityTransition(this.strokeDuration, this.easing);
    } else {
      stroke.setProgress(0);
    }
  }

  /**
   * Show a stroke with animation
   */
  private showStrokeAnimated(stroke: RenderedStroke): void {
    if (this.strokeEffect === 'draw') {
      stroke.element.getBoundingClientRect();
      stroke.setProgress(1);
    } else if (this.strokeEffect === 'fade') {
      stroke.element.getBoundingClientRect();
      stroke.setOpacity(1);
    } else {
      // 'none': show instantly
      stroke.setProgress(1);
    }
  }

  /**
   * Subscribe to animation events
   */
  on(event: AnimationEventType, handler: AnimationEventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  /**
   * Dispose animator and clean up
   */
  dispose(): void {
    this.clearAnimationTimeout();
    this.listeners.clear();
    this.strokes = [];
    this._state = 'idle';
    this._currentStroke = 0;
    this.isAnimatingStroke = false;
  }

  /**
   * Animate the next stroke in sequence
   */
  private animateNextStroke(): void {
    if (this._state !== 'playing') return;

    if (this._currentStroke >= this.strokes.length) {
      this._state = 'completed';
      this.emit({
        type: 'complete',
        totalStrokes: this.strokes.length,
      });

      if (this.loop) {
        // Wait, then reset (showing clean pad), then wait again before replaying
        const halfDelay = (this.loopDelay * 1000) / 2;
        this.animationTimeout = setTimeout(() => {
          this.reset();
          this.animationTimeout = setTimeout(() => {
            this.play();
          }, halfDelay);
        }, halfDelay);
      }
      return;
    }

    this.animateStroke(this._currentStroke).then(() => {
      if (this._state === 'playing') {
        this.animateNextStroke();
      }
    });
  }

  /**
   * Animate a single stroke
   */
  private animateStroke(index: number): Promise<void> {
    return new Promise((resolve) => {
      this.isAnimatingStroke = true;

      const stroke = this.strokes[index];

      this.emit({
        type: 'strokeStart',
        strokeIndex: index,
        totalStrokes: this.strokes.length,
      });

      // Show stroke with animation (or instantly for 'none' effect)
      this.showStrokeAnimated(stroke);

      // Wait for duration before completing
      this.animationTimeout = setTimeout(() => {
        this._currentStroke = index + 1;
        this.isAnimatingStroke = false;

        this.emit({
          type: 'strokeComplete',
          strokeIndex: index,
          totalStrokes: this.strokes.length,
        });

        resolve();
      }, this.strokeDuration * 1000);
    });
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: AnimationEvent): void {
    const handlers = this.listeners.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (e) {
          console.error('Error in animation event handler:', e);
        }
      }
    }
  }

  /**
   * Clear any pending animation timeout
   */
  private clearAnimationTimeout(): void {
    if (this.animationTimeout !== null) {
      clearTimeout(this.animationTimeout);
      this.animationTimeout = null;
    }
  }
}
