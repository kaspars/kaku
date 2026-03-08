import * as THREE from 'three';

export type AnimationEffect = 'static' | 'wandering' | 'jumpy' | 'leap';

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

interface LeapState {
  heading: number;
  targetHeading: number;
  phase: 'idle' | 'turning' | 'crouch' | 'airborne' | 'land';
  timer: number;
  /** Walk phase for the turning step */
  turnWalkPhase: number;
  leapSpeed: number;
  leapHeight: number;
  airTime: number;
  airElapsed: number;
  crouchDuration: number;
}

interface AnimatedEntry {
  model: THREE.Group;
  wander: WanderState | null;
  leap: LeapState | null;
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

  function createLeapState(): LeapState {
    const heading = Math.random() * Math.PI * 2;
    return {
      heading,
      targetHeading: heading,
      phase: 'idle',
      timer: 1 + Math.random() * 2,
      turnWalkPhase: 0,
      leapSpeed: 0,
      leapHeight: 0,
      airTime: 0,
      airElapsed: 0,
      crouchDuration: 0,
    };
  }

  function rollLeapParams(leap: LeapState) {
    // Wide range of leap sizes — small hops to big bounds
    const size = Math.random(); // 0 = tiny hop, 1 = big leap
    leap.leapHeight = 15 + size * 60;          // 15–75
    leap.leapSpeed = 80 + size * 140;           // 80–220
    leap.airTime = 0.35 + size * 0.4;           // 0.35–0.75s
    leap.crouchDuration = 0.25 + size * 0.25;   // 0.25–0.5s (bigger leap = longer windup)
  }

  function updateLeapEntry(entry: AnimatedEntry, delta: number) {
    const { model, leap } = entry;
    if (!leap) return;

    leap.timer -= delta;

    switch (leap.phase) {
      case 'idle': {
        // Gentle breathing — subtle sway and scale pulse
        const breath = Math.sin(Date.now() * 0.0025);
        model.rotation.z = breath * 0.015;
        model.rotation.x = 0;
        model.position.y = 0;
        model.scale.setScalar(1);
        model.rotation.y = Math.PI + leap.heading;

        if (leap.timer <= 0) {
          // Pick new direction and start turning toward it
          const turnAmount = (Math.PI / 6) + Math.random() * (Math.PI * 0.8);
          const sign = Math.random() < 0.5 ? 1 : -1;
          leap.targetHeading = leap.heading + sign * turnAmount;
          leap.phase = 'turning';
          leap.turnWalkPhase = 0;
          rollLeapParams(leap);
        }
        break;
      }

      case 'turning': {
        // Step-turn toward target heading using walk-like motion
        let diff = leap.targetHeading - leap.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        const turnRate = 2.5;
        const maxTurn = turnRate * delta;
        if (Math.abs(diff) < maxTurn) {
          leap.heading = leap.targetHeading;
        } else {
          leap.heading += Math.sign(diff) * maxTurn;
        }

        // Walk-like stepping during turn
        leap.turnWalkPhase += delta * 2.5;
        const phase = leap.turnWalkPhase * Math.PI * 2;
        model.rotation.z = Math.sin(phase) * 0.06;
        model.rotation.y = Math.PI + leap.heading;
        model.position.y = Math.abs(Math.sin(phase)) * 2;


        // Small forward movement during turn
        model.position.x += Math.sin(leap.heading) * 12 * delta;
        model.position.z += Math.cos(leap.heading) * 12 * delta;

        // Done turning — transition to crouch
        if (Math.abs(diff) < 0.05) {
          leap.phase = 'crouch';
          leap.timer = leap.crouchDuration;
          model.rotation.z = 0;
          model.position.y = 0;
        }
        break;
      }

      case 'crouch': {
        // Squash and stretch: compress Y, expand XZ (volume preservation)
        const t = 1 - (leap.timer / leap.crouchDuration); // 0 → 1
        const eased = t * t; // ease-in for building tension
        const squashY = 1 - eased * 0.3;     // 1.0 → 0.7
        const stretchXZ = 1 + eased * 0.15;  // 1.0 → 1.15
        model.scale.set(stretchXZ, squashY, stretchXZ);

        // Lean forward progressively
        model.rotation.x = eased * 0.2;
        model.rotation.y = Math.PI + leap.heading;
        model.rotation.z = 0;
        model.position.y = 0;

        if (leap.timer <= 0) {
          leap.phase = 'airborne';
          leap.airElapsed = 0;
          // Snap to stretched shape for launch
          model.scale.set(0.9, 1.2, 0.9);
        }
        break;
      }

      case 'airborne': {
        leap.airElapsed += delta;
        const t = Math.min(1, leap.airElapsed / leap.airTime);

        // Parabolic arc
        model.position.y = 4 * leap.leapHeight * t * (1 - t);

        // Forward movement
        model.position.x += Math.sin(leap.heading) * leap.leapSpeed * delta;
        model.position.z += Math.cos(leap.heading) * leap.leapSpeed * delta;

        // Stretch tall at launch, normalize mid-flight, squash on approach
        let scaleY: number, scaleXZ: number;
        if (t < 0.2) {
          // Launch stretch
          const lt = t / 0.2;
          scaleY = 1.2 - lt * 0.2;    // 1.2 → 1.0
          scaleXZ = 0.9 + lt * 0.1;   // 0.9 → 1.0
        } else if (t > 0.8) {
          // Pre-landing squash
          const lt = (t - 0.8) / 0.2;
          scaleY = 1.0 - lt * 0.2;    // 1.0 → 0.8
          scaleXZ = 1.0 + lt * 0.1;   // 1.0 → 1.1
        } else {
          scaleY = 1.0;
          scaleXZ = 1.0;
        }
        model.scale.set(scaleXZ, scaleY, scaleXZ);

        // Tilt: lean forward on ascent, lean back slightly on descent
        model.rotation.x = t < 0.5 ? 0.12 * (1 - t * 2) : -0.05 * ((t - 0.5) * 2);
        model.rotation.y = Math.PI + leap.heading;
        model.rotation.z = 0;

        // Boundary
        const margin = 100;
        const limit = boundsHalfSize - margin;
        if (Math.abs(model.position.x) > limit || Math.abs(model.position.z) > limit) {
          model.position.x = Math.max(-limit, Math.min(limit, model.position.x));
          model.position.z = Math.max(-limit, Math.min(limit, model.position.z));
          leap.heading = Math.atan2(-model.position.x, -model.position.z);
        }

        if (t >= 1) {
          leap.phase = 'land';
          leap.timer = 0.2;
          model.position.y = 0;
          model.scale.set(1.15, 0.75, 1.15); // landing squash
          playFootstep(entry);
        }
        break;
      }

      case 'land': {
        // Recover from squash back to normal
        const t = 1 - (leap.timer / 0.2); // 0 → 1
        const eased = t * (2 - t); // ease-out
        const scaleY = 0.75 + eased * 0.25;
        const scaleXZ = 1.15 - eased * 0.15;
        model.scale.set(scaleXZ, scaleY, scaleXZ);
        model.rotation.x = 0.05 * (1 - eased);
        model.position.y = 0;

        if (leap.timer <= 0) {
          leap.phase = 'idle';
          leap.timer = 1.5 + Math.random() * 3.5;
          model.scale.setScalar(1);
          model.rotation.x = 0;
        }
        break;
      }
    }
  }

  function initEntry(entry: AnimatedEntry) {
    if (effect === 'wandering' || effect === 'jumpy') {
      entry.wander = createWanderState();
      entry.leap = null;
      if (audioListener) attachAudio(entry);
    } else if (effect === 'leap') {
      entry.wander = null;
      entry.leap = createLeapState();
      if (audioListener) attachAudio(entry);
    } else {
      entry.wander = null;
      entry.leap = null;
      detachAudio(entry);
    }
  }

  const COLLISION_RADIUS = 60;

  function isMoving(entry: AnimatedEntry): boolean {
    return !!(entry.wander || entry.leap);
  }

  function resolveCollisions() {
    for (let i = 0; i < entries.length; i++) {
      const a = entries[i];
      if (!isMoving(a)) continue;
      for (let j = i + 1; j < entries.length; j++) {
        const b = entries[j];
        if (!isMoving(b)) continue;
        const dx = a.model.position.x - b.model.position.x;
        const dz = a.model.position.z - b.model.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < COLLISION_RADIUS && dist > 0) {
          const overlap = (COLLISION_RADIUS - dist) / 2;
          const nx = dx / dist;
          const nz = dz / dist;
          a.model.position.x += nx * overlap;
          a.model.position.z += nz * overlap;
          b.model.position.x -= nx * overlap;
          b.model.position.z -= nz * overlap;
          // Steer away
          if (a.wander) a.wander.targetHeading = Math.atan2(nx, nz);
          if (a.leap) a.leap.heading = Math.atan2(nx, nz);
          if (b.wander) b.wander.targetHeading = Math.atan2(-nx, -nz);
          if (b.leap) b.leap.heading = Math.atan2(-nx, -nz);
        }
      }
    }
  }

  return {
    update(delta: number) {
      if (effect === 'static') return;
      for (const entry of entries) {
        if (entry.leap) {
          updateLeapEntry(entry, delta);
        } else {
          updateEntry(entry, delta);
        }
      }
      resolveCollisions();
    },

    addModel(model: THREE.Group, eff: AnimationEffect) {
      effect = eff;
      if (eff === 'wandering' || eff === 'jumpy') {
        style = WALK_STYLES[eff];
      }
      const entry: AnimatedEntry = { model, wander: null, leap: null, audio: null };
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
