import * as THREE from 'three';

export type AnimationEffect = 'static' | 'wandering' | 'jumpy';

export interface CharacterAnimator {
  /** Update all animations each frame */
  update(delta: number): void;
  /** Register a model for animation */
  addModel(model: THREE.Group, effect: AnimationEffect): void;
  /** Remove a model from animation */
  removeModel(model: THREE.Group): void;
  /** Change effect for all registered models */
  setEffect(effect: AnimationEffect): void;
  /** Set the AudioListener for spatial footstep sounds */
  setAudioListener(listener: THREE.AudioListener): void;
  /** Remove all models */
  clear(): void;
  /** Clean up */
  dispose(): void;
}

interface WanderState {
  heading: number;
  targetHeading: number;
  nextTurnIn: number;
  walkPhase: number;
  speed: number;
  paused: boolean;
  pauseTimer: number;
  lastStepHalf: number;
}

interface AnimatedEntry {
  model: THREE.Group;
  wander: WanderState | null;
  audio: THREE.PositionalAudio | null;
}

/** Parameters that define a walk style */
interface WalkStyle {
  speed: number;
  speedVariation: number;
  rockAngle: number;
  bobHeight: number;
  stepFrequency: number;
  turnRate: number;
  forwardLean: number;
  idleSwayScale: number;
  pauseChance: number;
  pauseMin: number;
  pauseMax: number;
  turnIntervalMin: number;
  turnIntervalMax: number;
  bobCurve: 'bounce' | 'smooth';
}

const WALK_STYLES: Record<'wandering' | 'jumpy', WalkStyle> = {
  wandering: {
    speed: 18,
    speedVariation: 0.15,
    rockAngle: 0.06,
    bobHeight: 2.5,
    stepFrequency: 0.55,
    turnRate: 0.3,
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
    rockAngle: 0.08,
    bobHeight: 3,
    stepFrequency: 4,
    turnRate: 1.5,
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
 * Create an animator that manages procedural effects for multiple character models.
 */
export function createAnimator(options: {
  boundsHalfSize?: number;
} = {}): CharacterAnimator {
  const boundsHalfSize = options.boundsHalfSize ?? 900;

  const entries: AnimatedEntry[] = [];
  let effect: AnimationEffect = 'static';
  let style: WalkStyle = WALK_STYLES.wandering;
  let audioListener: THREE.AudioListener | null = null;

  function getAudioContext(): AudioContext | null {
    return audioListener?.context ?? null;
  }

  function playFootstep(entry: AnimatedEntry) {
    if (!entry.audio) return;
    const ctx = getAudioContext();
    if (!ctx || ctx.state === 'suspended') return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(gain);
    gain.connect(entry.audio.panner);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  function attachAudio(entry: AnimatedEntry) {
    if (!audioListener) return;
    detachAudio(entry);

    const audio = new THREE.PositionalAudio(audioListener);
    audio.setRefDistance(100);
    audio.setRolloffFactor(1.5);
    audio.setMaxDistance(1500);
    entry.model.add(audio);
    entry.audio = audio;
  }

  function detachAudio(entry: AnimatedEntry) {
    if (entry.audio) {
      if (entry.audio.parent) entry.audio.parent.remove(entry.audio);
      entry.audio = null;
    }
  }

  function createWanderState(): WanderState {
    return {
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

  function pickNewDirection(wander: WanderState) {
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

  function updateEntry(entry: AnimatedEntry, delta: number) {
    const { model, wander } = entry;
    if (!wander) return;

    // Handle pause
    if (wander.paused) {
      wander.pauseTimer -= delta;
      if (wander.pauseTimer <= 0) wander.paused = false;
      wander.walkPhase += delta * style.stepFrequency * 0.2;
      const idleSway = Math.sin(wander.walkPhase * Math.PI * 2) * style.rockAngle * style.idleSwayScale;
      model.rotation.z = idleSway;
      model.rotation.x = 0;
      return;
    }

    // Smooth turning
    let headingDiff = wander.targetHeading - wander.heading;
    while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
    while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
    const maxTurn = style.turnRate * delta;
    if (Math.abs(headingDiff) < maxTurn) {
      wander.heading = wander.targetHeading;
    } else {
      wander.heading += Math.sign(headingDiff) * maxTurn;
    }

    // Walk cycle
    wander.walkPhase += delta * style.stepFrequency;
    const phase = wander.walkPhase * Math.PI * 2;

    // Rock
    model.rotation.z = Math.sin(phase) * style.rockAngle;

    // Footstep detection
    const currentStepHalf = Math.floor(wander.walkPhase * 2);
    if (currentStepHalf !== wander.lastStepHalf) {
      wander.lastStepHalf = currentStepHalf;
      playFootstep(entry);
    }

    // Bob
    let bob: number;
    if (style.bobCurve === 'smooth') {
      bob = (1 - Math.cos(phase * 2)) / 2 * style.bobHeight;
    } else {
      bob = Math.abs(Math.sin(phase)) * style.bobHeight;
    }

    model.rotation.x = style.forwardLean;
    model.rotation.y = Math.PI + wander.heading;

    // Stride-synced movement
    const strideProgress = Math.abs(Math.cos(phase));
    const strideFactor = 0.05 + 0.95 * strideProgress * strideProgress;
    model.position.x += Math.sin(wander.heading) * wander.speed * strideFactor * delta;
    model.position.z += Math.cos(wander.heading) * wander.speed * strideFactor * delta;
    model.position.y = bob;

    // Boundary
    const margin = 100;
    const limit = boundsHalfSize - margin;
    if (Math.abs(model.position.x) > limit || Math.abs(model.position.z) > limit) {
      model.position.x = Math.max(-limit, Math.min(limit, model.position.x));
      model.position.z = Math.max(-limit, Math.min(limit, model.position.z));
      wander.targetHeading = Math.atan2(-model.position.x, -model.position.z);
      wander.nextTurnIn = style.turnIntervalMin + Math.random() * 3;
    }

    // Direction change countdown
    wander.nextTurnIn -= delta;
    if (wander.nextTurnIn <= 0) {
      pickNewDirection(wander);
    }
  }

  function initEntry(entry: AnimatedEntry) {
    if (effect === 'wandering' || effect === 'jumpy') {
      entry.wander = createWanderState();
      if (audioListener) attachAudio(entry);
    } else {
      entry.wander = null;
      detachAudio(entry);
    }
  }

  return {
    update(delta: number) {
      if (effect === 'static') return;
      for (const entry of entries) {
        updateEntry(entry, delta);
      }
    },

    addModel(model: THREE.Group, eff: AnimationEffect) {
      effect = eff;
      if (eff === 'wandering' || eff === 'jumpy') {
        style = WALK_STYLES[eff];
      }
      const entry: AnimatedEntry = { model, wander: null, audio: null };
      entries.push(entry);
      initEntry(entry);
    },

    removeModel(model: THREE.Group) {
      const idx = entries.findIndex(e => e.model === model);
      if (idx >= 0) {
        detachAudio(entries[idx]);
        entries.splice(idx, 1);
      }
    },

    setEffect(eff: AnimationEffect) {
      effect = eff;
      if (eff === 'wandering' || eff === 'jumpy') {
        style = WALK_STYLES[eff];
      }
      for (const entry of entries) {
        entry.model.rotation.set(0, 0, 0);
        entry.model.position.y = 0;
        initEntry(entry);
      }
    },

    setAudioListener(listener: THREE.AudioListener) {
      audioListener = listener;
      for (const entry of entries) {
        if (entry.wander && !entry.audio) {
          attachAudio(entry);
        }
      }
    },

    clear() {
      for (const entry of entries) {
        entry.model.rotation.set(0, 0, 0);
        entry.model.position.y = 0;
        detachAudio(entry);
      }
      entries.length = 0;
    },

    dispose() {
      this.clear();
      audioListener = null;
    },
  };
}
