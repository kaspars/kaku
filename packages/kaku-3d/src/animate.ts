import * as THREE from 'three';

export type AnimationEffect = 'static' | 'wandering' | 'jumpy';

export interface CharacterAnimator {
  /** Update animations each frame */
  update(delta: number): void;
  /** Set the active model and effect */
  setModel(model: THREE.Group | null, effect: AnimationEffect): void;
  /** Set the AudioListener (typically attached to the camera) to enable footstep sounds */
  setAudioListener(listener: THREE.AudioListener): void;
  /** Clean up */
  dispose(): void;
}

interface WanderState {
  /** Current heading in radians (Y rotation) */
  heading: number;
  /** Target heading to turn toward */
  targetHeading: number;
  /** Time until next direction change */
  nextTurnIn: number;
  /** Walk cycle phase (advances continuously) */
  walkPhase: number;
  /** Current walk speed */
  speed: number;
  /** Whether currently pausing */
  paused: boolean;
  /** Time remaining in pause */
  pauseTimer: number;
  /** Which half of the step cycle we're in (0 or 1), for detecting foot plants */
  lastStepHalf: number;
}

/** Parameters that define a walk style */
interface WalkStyle {
  speed: number;
  speedVariation: number;
  rockAngle: number;
  bobHeight: number;
  /** Steps per second */
  stepFrequency: number;
  /** How fast it turns (radians/sec) */
  turnRate: number;
  /** Forward lean angle */
  forwardLean: number;
  /** Idle sway multiplier */
  idleSwayScale: number;
  /** Pause probability on direction change */
  pauseChance: number;
  /** Min/max pause duration */
  pauseMin: number;
  pauseMax: number;
  /** Min/max time between direction changes */
  turnIntervalMin: number;
  turnIntervalMax: number;
  /** Bob curve: 'bounce' = abs(sin), 'smooth' = (1 - cos) / 2 */
  bobCurve: 'bounce' | 'smooth';
}

const WALK_STYLES: Record<'wandering' | 'jumpy', WalkStyle> = {
  wandering: {
    speed: 18,
    speedVariation: 0.15,
    rockAngle: 0.06,         // pronounced but slow weight shift
    bobHeight: 2.5,          // visible rise per step
    stepFrequency: 0.55,     // very slow, heavy steps
    turnRate: 0.3,            // unhurried turns
    forwardLean: 0.012,
    idleSwayScale: 0.1,
    pauseChance: 0.45,
    pauseMin: 3,
    pauseMax: 7,
    turnIntervalMin: 8,
    turnIntervalMax: 18,
    bobCurve: 'smooth',
  },
  jumpy: {
    speed: 30,
    speedVariation: 0.6,
    rockAngle: 0.08,          // pronounced tilt
    bobHeight: 3,             // bouncy
    stepFrequency: 4,         // quick steps
    turnRate: 1.5,            // snappy turns
    forwardLean: 0.03,
    idleSwayScale: 0.3,
    pauseChance: 0.3,
    pauseMin: 1,
    pauseMax: 2,
    turnIntervalMin: 3,
    turnIntervalMax: 5,
    bobCurve: 'bounce',
  },
};

/**
 * Create an animator that applies procedural effects to character models.
 */
export function createAnimator(options: {
  /** Half-size of the ground area for boundary clamping */
  boundsHalfSize?: number;
} = {}): CharacterAnimator {
  const boundsHalfSize = options.boundsHalfSize ?? 900;

  let model: THREE.Group | null = null;
  let effect: AnimationEffect = 'static';
  let wander: WanderState | null = null;
  let style: WalkStyle = WALK_STYLES.wandering;

  // Audio
  let audioListener: THREE.AudioListener | null = null;
  let positionalAudio: THREE.PositionalAudio | null = null;
  let audioContext: AudioContext | null = null;

  /**
   * Synthesize a short low-frequency thump and play it via the PositionalAudio.
   * The volume and panning are handled automatically by Three.js based on distance.
   */
  function playFootstep() {
    if (!positionalAudio || !audioContext) return;

    // Resume AudioContext on first footstep (browsers require user gesture)
    if (audioContext.state === 'suspended') {
      audioContext.resume();
      return;
    }

    // Create a short thump: low-frequency oscillator with fast decay
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    // Connect through the PositionalAudio's panner for spatial positioning
    osc.connect(gain);
    gain.connect(positionalAudio.panner);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  function attachAudio() {
    if (!model || !audioListener) return;

    // Remove old audio if any
    detachAudio();

    positionalAudio = new THREE.PositionalAudio(audioListener);
    positionalAudio.setRefDistance(100);
    positionalAudio.setRolloffFactor(1.5);
    positionalAudio.setMaxDistance(1500);
    model.add(positionalAudio);

    audioContext = audioListener.context;
  }

  function detachAudio() {
    if (positionalAudio) {
      if (positionalAudio.parent) {
        positionalAudio.parent.remove(positionalAudio);
      }
      positionalAudio = null;
    }
  }

  function initWander() {
    wander = {
      heading: Math.random() * Math.PI * 2,
      targetHeading: Math.random() * Math.PI * 2,
      nextTurnIn: style.turnIntervalMin + Math.random() * (style.turnIntervalMax - style.turnIntervalMin),
      walkPhase: 0,
      speed: style.speed * (1 - style.speedVariation / 2 + Math.random() * style.speedVariation),
      paused: false,
      pauseTimer: 0,
      lastStepHalf: 0,
    };
  }

  function pickNewDirection() {
    if (!wander) return;
    // Turn between 30 and 120 degrees in random direction
    const turnAmount = (Math.PI / 6) + Math.random() * (Math.PI / 2);
    const sign = Math.random() < 0.5 ? 1 : -1;
    wander.targetHeading = wander.heading + sign * turnAmount;
    wander.nextTurnIn = style.turnIntervalMin + Math.random() * (style.turnIntervalMax - style.turnIntervalMin);
    wander.speed = style.speed * (1 - style.speedVariation / 2 + Math.random() * style.speedVariation);

    if (Math.random() < style.pauseChance) {
      wander.paused = true;
      wander.pauseTimer = style.pauseMin + Math.random() * (style.pauseMax - style.pauseMin);
    }
  }

  function updateWander(delta: number) {
    if (!model || !wander) return;

    // Handle pause
    if (wander.paused) {
      wander.pauseTimer -= delta;
      if (wander.pauseTimer <= 0) {
        wander.paused = false;
      }
      // Gentle idle sway while paused
      wander.walkPhase += delta * style.stepFrequency * 0.2;
      const idleSway = Math.sin(wander.walkPhase * Math.PI * 2) * style.rockAngle * style.idleSwayScale;
      model.rotation.z = idleSway;
      model.rotation.x = 0;
      return;
    }

    // Smoothly turn toward target heading
    let headingDiff = wander.targetHeading - wander.heading;
    while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
    while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;

    const maxTurn = style.turnRate * delta;
    if (Math.abs(headingDiff) < maxTurn) {
      wander.heading = wander.targetHeading;
    } else {
      wander.heading += Math.sign(headingDiff) * maxTurn;
    }

    // Advance walk cycle
    wander.walkPhase += delta * style.stepFrequency;
    const phase = wander.walkPhase * Math.PI * 2;

    // Side-to-side rock (Z rotation) — smooth sine wave
    const rock = Math.sin(phase) * style.rockAngle;
    model.rotation.z = rock;

    // Detect foot plants: each time sin(phase) crosses a peak (±1),
    // we've completed a half-step. Track via floor(phase / PI + 0.5).
    const currentStepHalf = Math.floor(wander.walkPhase * 2);
    if (currentStepHalf !== wander.lastStepHalf) {
      wander.lastStepHalf = currentStepHalf;
      playFootstep();
    }

    // Vertical bob
    let bob: number;
    if (style.bobCurve === 'smooth') {
      // Smooth rise and fall — peaks once per step, never jarring
      bob = (1 - Math.cos(phase * 2)) / 2 * style.bobHeight;
    } else {
      // Bouncy — snaps up at each step
      bob = Math.abs(Math.sin(phase)) * style.bobHeight;
    }

    // Forward lean
    model.rotation.x = style.forwardLean;

    // Face the movement direction
    model.rotation.y = Math.PI + wander.heading;

    // Modulate forward speed by walk cycle:
    // At mid-stride (upright, rock crossing zero) — full speed (pushing off)
    // At foot plant (max rock) — nearly stopped
    const strideProgress = Math.abs(Math.cos(phase));
    const strideFactor = 0.05 + 0.95 * strideProgress * strideProgress;
    const moveX = Math.sin(wander.heading) * wander.speed * strideFactor * delta;
    const moveZ = Math.cos(wander.heading) * wander.speed * strideFactor * delta;
    model.position.x += moveX;
    model.position.z += moveZ;

    model.position.y = bob;

    // Boundary: if approaching wall, turn toward center
    const margin = 100;
    const limit = boundsHalfSize - margin;
    if (Math.abs(model.position.x) > limit || Math.abs(model.position.z) > limit) {
      model.position.x = Math.max(-limit, Math.min(limit, model.position.x));
      model.position.z = Math.max(-limit, Math.min(limit, model.position.z));
      wander.targetHeading = Math.atan2(-model.position.x, -model.position.z);
      wander.nextTurnIn = style.turnIntervalMin + Math.random() * 3;
    }

    // Countdown to next direction change
    wander.nextTurnIn -= delta;
    if (wander.nextTurnIn <= 0) {
      pickNewDirection();
    }
  }

  return {
    update(delta: number) {
      if (!model || effect === 'static') return;
      updateWander(delta);
    },

    setModel(newModel: THREE.Group | null, newEffect: AnimationEffect) {
      // Reset previous model's transforms
      if (model && model !== newModel) {
        model.rotation.set(0, 0, 0);
      }

      detachAudio();
      model = newModel;
      effect = newEffect;
      wander = null;

      if (newEffect === 'wandering' || newEffect === 'jumpy') {
        style = WALK_STYLES[newEffect];
      }

      if (model && effect !== 'static') {
        initWander();
        if (audioListener) attachAudio();
      }
    },

    setAudioListener(listener: THREE.AudioListener) {
      audioListener = listener;
      // Attach audio if model already exists and is animating
      if (model && effect !== 'static') {
        attachAudio();
      }
    },

    dispose() {
      detachAudio();
      model = null;
      wander = null;
      audioListener = null;
      audioContext = null;
    },
  };
}
