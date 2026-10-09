/**
 * Crevo animation engine.
 *
 * Pure TypeScript (no React, no three.js) so the same logic can drive the web
 * component, a future React Native / expo-three renderer, or unit tests.
 *
 * Architecture
 * ------------
 *   target pose  =  mood base expression          (absolute, springs blend between moods)
 *                +  mood motion layer(s)           (additive, cross-faded on mood change)
 *                +  one-shot reactions             (additive, always run to completion)
 *                +  pointer / hover / drag layers  (additive, interaction)
 *                +  idle layer                     (breathing, blinking, posture, gaze)
 *
 *   pose  =  critically/under-damped springs chasing the target pose.
 *
 * Springs are what make mood changes smooth and give the body its jelly-like
 * squash-and-stretch overshoot. A few "direct" channels (spin, blink, bead phase,
 * lift while falling) bypass the springs because they are either cyclic or
 * physically simulated.
 */
import type { CrevoMood, CrevoReaction } from './CrevoMascot.types'

/* ------------------------------------------------------------------ */
/* Math helpers                                                        */
/* ------------------------------------------------------------------ */

export const TAU = Math.PI * 2

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)

export const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/** Sine bump: 0 outside [a, b], 1 in the middle, zero slope-free ends at a and b. */
export const bump = (t: number, a: number, b: number): number => {
  if (t <= a || t >= b) return 0
  return Math.sin(((t - a) / (b - a)) * Math.PI)
}

/** Smooth 0→1→0 plateau: ramps up over [a, a+r], holds, ramps down over [b-r, b]. */
export const plateau = (t: number, a: number, b: number, r: number): number =>
  smoothstep(a, a + r, t) * (1 - smoothstep(b - r, b, t))

/* ------------------------------------------------------------------ */
/* Pose                                                                */
/* ------------------------------------------------------------------ */

/**
 * Every animatable channel. Units: world units for offsets/lift, radians for
 * angles, dimensionless for the rest.
 */
export const POSE_KEYS = [
  // whole figure
  'offsetX', //   drag / nudge position
  'offsetY', //   drag lift (direct, physically simulated)
  // body
  'bodyX',
  'bodyY', //     hop height
  'stretch', //   +tall/thin, -squat/wide (volume preserving)
  'tiltX', //     + leans forward (toward viewer)
  'tiltZ', //     roll, + leans to viewer's left
  'yaw', //       lean-turn toward pointer
  'spin', //      full-turn channel (direct)
  // eyes
  'eyeOpen', //   ball height 0..1.3
  'eyeSmile', //  0..1 ^ arc  (happy)
  'eyeClosed', // 0..1 ∪ arc  (sleep)
  'eyeSize',
  'eyeTilt', //   + focused (inner down), - sad
  'eyeLookX',
  'eyeLookY',
  'blink', //     0..1 (direct)
  // crest + bead
  'crestSway',
  'crestPerk', // -1 drooping … +1 perked
  'crestCurl',
  'beadSpeed',
  'beadPhase', // direct, integrated from beadSpeed
  'beadRadius',
  'beadGlow',
  // feet + glow
  'footL',
  'footR',
  'glow',
] as const

export type PoseKey = (typeof POSE_KEYS)[number]
export type Pose = Record<PoseKey, number>

const REST_VALUES: Pose = {
  offsetX: 0,
  offsetY: 0,
  bodyX: 0,
  bodyY: 0,
  stretch: 0,
  tiltX: 0,
  tiltZ: 0,
  yaw: 0,
  spin: 0,
  eyeOpen: 1,
  eyeSmile: 0,
  eyeClosed: 0,
  eyeSize: 1,
  eyeTilt: 0,
  eyeLookX: 0,
  eyeLookY: 0,
  blink: 0,
  crestSway: 0,
  crestPerk: 0,
  crestCurl: 0,
  beadSpeed: 0.7,
  beadPhase: 0,
  beadRadius: 0.1,
  beadGlow: 0,
  footL: 0,
  footR: 0,
  glow: 0,
}

export const createPose = (): Pose => ({ ...REST_VALUES })
export const REST_POSE: Readonly<Pose> = Object.freeze(createPose())

/** Channels that bypass the spring solver. */
const DIRECT_KEYS: readonly PoseKey[] = ['spin', 'blink', 'beadPhase', 'offsetY']
const SPRUNG_KEYS: readonly PoseKey[] = POSE_KEYS.filter((k) => !DIRECT_KEYS.includes(k))

/**
 * Spring parameters per channel: ω = natural frequency (rad/s), ζ = damping
 * ratio (<1 overshoots, 1 = critical). Low ζ on the crest gives it a floppy tail.
 */
const SPRING: Record<string, readonly [number, number]> = {
  offsetX: [34, 0.85],
  bodyX: [30, 0.8],
  bodyY: [42, 0.8],
  stretch: [30, 0.5],
  tiltX: [16, 0.6],
  tiltZ: [16, 0.55],
  yaw: [14, 0.8],
  eyeOpen: [38, 1],
  eyeSmile: [30, 1],
  eyeClosed: [26, 1],
  eyeSize: [30, 0.8],
  eyeTilt: [26, 1],
  eyeLookX: [22, 0.85],
  eyeLookY: [22, 0.85],
  crestSway: [12, 0.32],
  crestPerk: [14, 0.45],
  crestCurl: [12, 0.45],
  beadSpeed: [6, 1],
  beadRadius: [9, 0.8],
  beadGlow: [10, 1],
  footL: [40, 0.7],
  footR: [40, 0.7],
  glow: [10, 1],
}
const DEFAULT_SPRING: readonly [number, number] = [20, 1]
/** Used instead of per-channel springs in reduced-motion mode: fast, never overshoots. */
const REDUCED_SPRING: readonly [number, number] = [26, 1]

/* ------------------------------------------------------------------ */
/* Shared motion primitives                                            */
/* ------------------------------------------------------------------ */

/**
 * A single anticipate → launch → airborne → land → settle hop, `u` ∈ [0,1].
 * This is where the squash-and-stretch comes from.
 */
function hop(o: Pose, u: number, a: number, height: number, squash = 1): void {
  if (u <= 0 || u >= 1) return
  o.bodyY += a * height * bump(u, 0.18, 0.72)
  o.stretch +=
    a *
    squash *
    (-0.17 * bump(u, 0, 0.18) +
      0.14 * bump(u, 0.18, 0.72) -
      0.19 * bump(u, 0.72, 0.92) +
      0.035 * bump(u, 0.92, 1))
  const tuck = 0.12 * bump(u, 0.18, 0.72) * a
  o.footL += tuck
  o.footR += tuck
  o.crestSway += a * 0.35 * bump(u, 0.2, 0.9) * Math.sin(u * 9)
}

/* ------------------------------------------------------------------ */
/* One-shot reactions                                                  */
/* ------------------------------------------------------------------ */

type InternalReaction = CrevoReaction | 'land'

interface ReactionDef {
  duration: number
  /** `a` is the motion amplitude (0 in reduced-motion mode: expression only). `k` = strength. */
  apply: (o: Pose, t: number, a: number, k: number) => void
  /** If `true`, triggering again while active is ignored (so a spin can't be restarted mid-turn). */
  uninterruptible?: boolean
  /** Safe under reduced motion (no pulses or movement). Non-calm reactions are skipped entirely there. */
  calm?: boolean
}

const REACTIONS: Record<InternalReaction, ReactionDef> = {
  click: {
    duration: 0.9,
    calm: true,
    apply(o, t, a) {
      hop(o, t / 0.85, a, 0.38, 1.15)
      const env = smoothstep(0, 0.1, t) * (1 - smoothstep(0.55, 0.9, t))
      o.eyeSmile += env
      o.crestPerk += 0.9 * env
      o.glow += 0.5 * env
      o.eyeSize += 0.06 * env
    },
  },
  startle: {
    duration: 0.85,
    uninterruptible: true,
    apply(o, t, a) {
      // Fast pop up, hang, soft landing.
      o.bodyY += a * 0.5 * bump(t, 0, 0.34)
      o.stretch +=
        a * (0.26 * bump(t, 0, 0.34) - 0.2 * bump(t, 0.34, 0.54) + 0.04 * bump(t, 0.54, 0.8))
      o.tiltX -= a * 0.12 * bump(t, 0, 0.45)
      o.footL += a * 0.16 * bump(t, 0, 0.34)
      o.footR += a * 0.16 * bump(t, 0, 0.34)
      const env = Math.exp(-t * 3.2)
      o.eyeSize += 0.32 * env
      o.eyeOpen += 0.2 * env
      o.eyeClosed -= 1.2 * env
      o.crestPerk += 1.2 * env
      o.crestSway += a * 0.5 * Math.sin(t * 38) * env
      o.glow += 0.4 * env
    },
  },
  celebrate: {
    duration: 2.1,
    uninterruptible: true,
    apply(o, t, a) {
      // Big spinning hop, then a smaller echo hop.
      const spinU = clamp((t - 0.14) / 0.78, 0, 1)
      if (a > 0.25) o.spin += TAU * easeInOutCubic(spinU)
      hop(o, (t - 0.0) / 1.08, a, 0.62, 1.3)
      hop(o, (t - 1.2) / 0.72, a, 0.26, 1)
      const env = smoothstep(0, 0.12, t) * (1 - smoothstep(1.8, 2.1, t))
      o.eyeSmile += env
      o.crestPerk += 1.2 * env
      o.glow += 0.7 * env
      o.beadGlow += 0.9 * env
      o.eyeSize += 0.08 * env
      o.beadSpeed += 5 * env * a
      o.beadRadius += 0.18 * env
    },
  },
  wiggle: {
    duration: 1.2,
    apply(o, t, a) {
      const env = Math.exp(-t * 2.6) * smoothstep(0, 0.05, t)
      o.tiltZ += a * 0.2 * Math.sin(t * TAU * 3.1) * env
      o.bodyY += a * 0.05 * Math.abs(Math.sin(t * TAU * 3.1)) * env
      o.crestSway += a * 0.6 * Math.sin(t * TAU * 3.1 - 1) * env
      o.eyeSize += 0.1 * env
      o.glow += 0.25 * env
    },
  },
  peek: {
    duration: 2.6,
    apply(o, t, a) {
      const left = plateau(t, 0.1, 1.2, 0.35)
      const right = plateau(t, 1.25, 2.4, 0.35)
      const dir = right - left
      o.eyeLookX += 0.95 * dir
      o.eyeLookY += 0.1 * (left + right)
      o.yaw += a * 0.2 * dir
      o.tiltZ -= a * 0.05 * dir
      o.crestSway -= a * 0.25 * dir
    },
  },
  land: {
    duration: 0.34,
    apply(o, t, a, k) {
      o.stretch += a * k * (-0.2 * bump(t, 0, 0.15) + 0.06 * bump(t, 0.15, 0.34))
      o.crestSway += a * k * 0.4 * Math.sin(t * 30) * Math.exp(-t * 7)
    },
  },
}

/* ------------------------------------------------------------------ */
/* Moods                                                               */
/* ------------------------------------------------------------------ */

interface MoodDef {
  /** Absolute targets overriding {@link REST_POSE}. */
  base: Partial<Pose>
  /** How strongly the eyes follow the pointer (0 = ignore). */
  look: number
  /** How strongly the body leans toward the pointer. */
  lean: number
  /** Weight of the idle layer (breathing, posture, gaze wander). */
  idle: number
  breath: { rate: number; depth: number }
  blink: boolean
  /** Additive steady-state motion. `t` = seconds in mood, `a` = amplitude (fade weight × intensity). */
  motion?: (o: Pose, t: number, a: number) => void
  /** Reaction played automatically whenever the mood is entered. */
  entry?: CrevoReaction
}

export const MOODS: Record<CrevoMood, MoodDef> = {
  idle: {
    base: {},
    look: 1,
    lean: 1,
    idle: 1,
    breath: { rate: 0.27, depth: 0.016 },
    blink: true,
  },

  happy: {
    base: { eyeSmile: 1, eyeSize: 1.06, crestPerk: 0.55, glow: 0.25, beadSpeed: 1.4, beadRadius: 0.16 },
    look: 0.6,
    lean: 0.6,
    idle: 0.6,
    breath: { rate: 0.4, depth: 0.014 },
    blink: false,
    motion(o, t, a) {
      // Three eager bounces on entry, then a calm sway with an occasional bounce.
      hop(o, t / 0.55, a, 0.3)
      hop(o, (t - 0.55) / 0.55, a, 0.3)
      hop(o, (t - 1.1) / 0.55, a, 0.3)
      if (t > 2.4) {
        const u = (t - 2.4) % 4.2
        hop(o, u / 0.6, a, 0.15, 0.8)
      }
      o.tiltZ += a * 0.05 * Math.sin(t * 2.1)
      o.crestSway += a * 0.2 * Math.sin(t * 3.2)
    },
  },

  thinking: {
    base: {
      tiltZ: 0.17,
      eyeOpen: 0.84,
      eyeSize: 0.96,
      eyeTilt: 0.08,
      crestCurl: 0.55,
      crestSway: 0.18,
      crestPerk: 0.2,
      beadSpeed: 1.8,
      beadRadius: 0.22,
      beadGlow: 0.3,
    },
    look: 0.15,
    lean: 0.3,
    idle: 0.5,
    breath: { rate: 0.25, depth: 0.012 },
    blink: true,
    motion(o, t, a) {
      // Eyes search up-and-around; never quite settling.
      const s = Math.sin(t * 1.15)
      o.eyeLookX += 0.7 * s
      o.eyeLookY += 0.5 + 0.18 * Math.sin(t * 2.3 + 1)
      o.tiltZ += a * 0.035 * Math.sin(t * 0.8)
      o.yaw += a * 0.12 * s
      o.crestSway += a * 0.18 * Math.sin(t * 1.4 + 0.5)
    },
  },

  listening: {
    base: {
      eyeSize: 1.15,
      eyeOpen: 1.08,
      tiltX: 0.1,
      stretch: 0.035,
      crestPerk: 0.95,
      crestCurl: -0.25,
      glow: 0.2,
      beadSpeed: 0.9,
      beadRadius: 0.13,
      beadGlow: 0.35,
    },
    look: 1.3,
    lean: 1.2,
    idle: 0.4,
    breath: { rate: 0.3, depth: 0.012 },
    blink: true,
    motion(o, t, a) {
      // Small attentive nods and a crest twitch, spaced out.
      const u = (t % 3.4) / 3.4
      o.tiltX += a * 0.06 * bump(u, 0.05, 0.3)
      o.stretch += a * -0.025 * bump(u, 0.05, 0.3)
      o.crestSway += a * 0.22 * Math.sin(t * 7) * bump(u, 0.55, 0.8)
    },
  },

  surprised: {
    base: {
      eyeSize: 1.28,
      eyeOpen: 1.12,
      stretch: 0.09,
      tiltX: -0.05,
      crestPerk: 1,
      glow: 0.3,
      beadSpeed: 2.6,
      beadRadius: 0.2,
    },
    look: 0.45,
    lean: 0.4,
    idle: 0.25,
    breath: { rate: 0.5, depth: 0.012 },
    blink: false,
    entry: 'startle',
    motion(o, t, a) {
      // Tiny tremor that fades away so the pose doesn't feel frozen.
      o.tiltZ += a * 0.012 * Math.sin(t * TAU * 8) * Math.exp(-t * 0.5)
      o.eyeSize -= 0.1 * smoothstep(2, 6, t)
    },
  },

  success: {
    base: {
      eyeSmile: 1,
      eyeSize: 1.06,
      crestPerk: 0.9,
      stretch: 0.04,
      glow: 0.45,
      beadSpeed: 2.2,
      beadRadius: 0.2,
      beadGlow: 0.8,
    },
    look: 0.3,
    lean: 0.4,
    idle: 0.7,
    breath: { rate: 0.38, depth: 0.014 },
    blink: false,
    entry: 'celebrate',
    motion(o, t, a) {
      // After the celebration: proud little hop every few seconds.
      if (t > 3) hop(o, ((t - 3) % 5) / 0.62, a, 0.14, 0.8)
      o.tiltZ += a * 0.04 * Math.sin(t * 1.6)
    },
  },

  error: {
    base: {
      eyeTilt: -0.3,
      eyeOpen: 0.8,
      eyeSize: 0.98,
      eyeLookY: -0.45,
      stretch: -0.07,
      tiltZ: 0.06,
      tiltX: 0.06,
      crestPerk: -0.85,
      crestCurl: 0.5,
      crestSway: -0.12,
      beadSpeed: 0.3,
      beadRadius: 0.07,
      beadGlow: -0.4,
    },
    look: 0.3,
    lean: 0.3,
    idle: 0.7,
    breath: { rate: 0.2, depth: 0.018 },
    blink: true,
    motion(o, t, a) {
      // One slow, gentle head shake, then an occasional soft sigh.
      o.tiltZ += a * 0.11 * Math.sin(t * TAU * 1.3) * Math.exp(-t * 1.6)
      o.yaw += a * 0.15 * Math.sin(t * TAU * 1.3) * Math.exp(-t * 1.6)
      if (t > 3) o.stretch -= a * 0.03 * bump((t - 3) % 7, 0, 1.6)
    },
  },

  sleeping: {
    base: {
      eyeClosed: 1,
      stretch: -0.06,
      tiltZ: 0.09,
      tiltX: 0.08,
      crestPerk: -1,
      crestCurl: 0.35,
      glow: -0.15,
      beadSpeed: 0.25,
      beadRadius: 0.05,
      beadGlow: -0.7,
    },
    look: 0,
    lean: 0,
    idle: 0.5,
    breath: { rate: 0.15, depth: 0.04 },
    blink: false,
    motion(o, t, a) {
      // Slow head nod, like dozing.
      o.tiltX += a * 0.035 * Math.sin(t * 0.55)
      o.tiltZ += a * 0.02 * Math.sin(t * 0.37 + 1)
    },
  },

  greeting: {
    base: {
      eyeOpen: 1.06,
      eyeSize: 1.1,
      crestPerk: 0.75,
      glow: 0.28,
      beadSpeed: 1.5,
      beadRadius: 0.17,
    },
    look: 0.8,
    lean: 0.5,
    idle: 0.4,
    breath: { rate: 0.3, depth: 0.012 },
    blink: true,
    motion(o, t, a) {
      // A friendly wave: body sways side to side, crest flicks, one foot lifts.
      const period = 4.4
      const u = t % period
      if (u < 2.3) {
        const env = smoothstep(0, 0.28, u) * (1 - smoothstep(1.95, 2.3, u))
        const ph = u * TAU * 1.9
        o.tiltZ += a * 0.21 * Math.sin(ph) * env
        o.yaw += a * 0.1 * Math.sin(ph + 1.2) * env
        o.bodyY += a * 0.05 * Math.abs(Math.sin(ph)) * env
        o.crestSway += a * 0.7 * Math.sin(ph - 0.9) * env
        o.footR += a * 0.2 * Math.max(0, Math.sin(ph + 0.4)) * env
        o.eyeSmile += 0.5 * env
        o.eyeOpen -= 0.25 * env
      }
    },
  },

  working: {
    base: {
      eyeOpen: 0.74,
      eyeTilt: 0.15,
      eyeSize: 0.98,
      tiltX: 0.12,
      crestPerk: 0.3,
      crestCurl: 0.3,
      glow: 0.3,
      beadSpeed: 6,
      beadRadius: 0.3,
      beadGlow: 0.9,
    },
    look: 0.12,
    lean: 0.25,
    idle: 0.25,
    breath: { rate: 0.5, depth: 0.01 },
    blink: true,
    motion(o, t, a) {
      // Eyes scan like reading lines; body gives a quick focused pulse.
      const s = (t * 0.85) % 1
      o.eyeLookX += 0.78 * (smoothstep(0, 0.88, s) * 2 - 1) * (s < 0.93 ? 1 : 1 - smoothstep(0.93, 1, s) * 2)
      o.eyeLookY += 0.12 * Math.sin(t * 2.4)
      o.stretch += a * 0.02 * Math.sin(t * TAU * 2.6)
      o.bodyY += a * 0.015 * Math.abs(Math.sin(t * TAU * 1.3))
      o.crestSway += a * 0.14 * Math.sin(t * TAU * 1.3)
    },
  },
}

/* ------------------------------------------------------------------ */
/* Controller                                                          */
/* ------------------------------------------------------------------ */

export interface CrevoControllerConfig {
  /** 0–2 motion amplitude multiplier. */
  intensity: number
  /** Calm static state: expression only, no motion, no tracking. */
  reducedMotion: boolean
  idleAnimations: boolean
  trackCursor: boolean
  interactive: boolean
  dragReturn: boolean
}

interface ActiveReaction {
  kind: InternalReaction
  t: number
  k: number
}

const MAX_DT = 1 / 20
const SUBSTEP = 1 / 90
const GRAVITY = 16

export class CrevoController {
  /** Smoothed output pose. Mutated in place every {@link update}; do not retain copies. */
  readonly pose: Pose = createPose()
  readonly config: CrevoControllerConfig = {
    intensity: 1,
    reducedMotion: false,
    idleAnimations: true,
    trackCursor: true,
    interactive: false,
    dragReturn: false,
  }

  /** `true` once every channel has come to rest (lets reduced-motion mode stop rendering). */
  settled = false
  /** Called when a reaction completes. */
  onReactionEnd?: (reaction: CrevoReaction) => void
  /** Called when state changes while idle so a demand-driven renderer can wake up. */
  onWake?: () => void

  private _mood: CrevoMood = 'idle'
  private moodT = 99
  private prevMood: CrevoMood | null = null
  private prevT = 0
  private time = 0

  private reactions: ActiveReaction[] = []
  private readonly rng: () => number

  // spring state, parallel to SPRUNG_KEYS
  private readonly x = new Float64Array(SPRUNG_KEYS.length)
  private readonly v = new Float64Array(SPRUNG_KEYS.length)
  private readonly tgt: Pose = createPose()

  // interaction state
  private hovered = false
  private focused = false
  private pressed = false
  private hoverAmt = 0
  private pressAmt = 0
  private pointerX = 0
  private pointerY = 0
  private pointerActive = 0 // smoothed 0..1
  private lastPointerAt = -999
  private dragging = false
  private dragTX = 0
  private dragTY = 0
  private dragVX = 0
  private restX = 0
  private liftV = 0
  private airborne = false

  // idle state
  private nextBlink: number
  private blinkT = -1
  private pendingBlink = -1
  private nextPosture: number
  private posture = { x: 0, z: 0 }
  private nextGaze: number
  private gaze = { x: 0, y: 0 }
  private nextPlayful: number

  constructor(rng: () => number = Math.random) {
    this.rng = rng
    this.nextBlink = 1.5 + rng() * 2
    this.nextPosture = 5 + rng() * 5
    this.nextGaze = 1 + rng() * 2
    this.nextPlayful = 20 + rng() * 20
    SPRUNG_KEYS.forEach((k, i) => (this.x[i] = REST_VALUES[k]))
    this.applyBase(this.tgt, this._mood)
    this.snap()
  }

  get mood(): CrevoMood {
    return this._mood
  }

  /** Amplitude multiplier for motion layers. */
  private get amp(): number {
    return this.config.reducedMotion ? 0 : clamp(this.config.intensity, 0, 2)
  }

  /* ----------------------------- public API ------------------------ */

  setConfig(partial: Partial<CrevoControllerConfig>): void {
    Object.assign(this.config, partial)
    this.wake()
  }

  setMood(mood: CrevoMood): void {
    if (mood === this._mood) return
    this.prevMood = this._mood
    this.prevT = this.moodT
    this._mood = mood
    this.moodT = 0
    const entry = MOODS[mood].entry
    if (entry) this.trigger(entry)
    this.wake()
  }

  /**
   * Initialise straight into a mood with no cross-fade (used on mount so the mascot
   * doesn't visibly morph from `idle`). Optionally plays the mood's entry reaction.
   */
  jumpTo(mood: CrevoMood, playEntry = false): void {
    this._mood = mood
    this.moodT = 0
    this.prevMood = null
    this.reactions = []
    this.applyBase(this.tgt, mood)
    this.snap()
    const entry = MOODS[mood].entry
    if (playEntry && entry) this.trigger(entry)
    this.wake()
  }

  /** Restart the current mood's motion and replay its entry reaction. */
  replay(): void {
    this.moodT = 0
    this.prevMood = null
    const entry = MOODS[this._mood].entry
    this.trigger(entry ?? 'wiggle')
  }

  trigger(kind: CrevoReaction): void {
    this.start(kind, 1)
  }

  /** Click / tap / keyboard activation. Sleeping Crevo gets startled instead of bouncing. */
  poke(): void {
    this.trigger(this._mood === 'sleeping' ? 'startle' : 'click')
  }

  /** Pointer position relative to the character, each axis roughly -1…1 (y up). */
  setPointer(x: number, y: number): void {
    this.pointerX = clamp(x, -1, 1)
    this.pointerY = clamp(y, -1, 1)
    this.lastPointerAt = this.time
    this.wake()
  }

  clearPointer(): void {
    this.lastPointerAt = -999
    this.wake()
  }

  setHover(hovered: boolean): void {
    if (this.hovered === hovered) return
    this.hovered = hovered
    this.wake()
  }

  setFocus(focused: boolean): void {
    if (this.focused === focused) return
    this.focused = focused
    this.wake()
  }

  setPress(pressed: boolean): void {
    this.pressed = pressed
    this.wake()
  }

  startDrag(): void {
    this.dragging = true
    this.airborne = false
    this.dragTX = this.pose.offsetX
    this.dragTY = this.pose.offsetY
    this.wake()
  }

  /** Move the drag target (world units, relative to the rest position). */
  dragTo(x: number, y: number): void {
    this.dragTX = x
    this.dragTY = Math.max(0, y)
    this.wake()
  }

  endDrag(): void {
    if (!this.dragging) return
    this.dragging = false
    this.restX = this.dragTX
    this.airborne = this.pose.offsetY > 0.001
    this.liftV = 0
    this.wake()
  }

  get isDragging(): boolean {
    return this.dragging
  }

  /** Keyboard nudge; behaves like a tiny drag-and-drop. */
  nudge(dx: number, dy: number, maxX: number, maxY: number): void {
    this.restX = clamp(this.restX + dx, -maxX, maxX)
    if (dy !== 0) {
      this.pose.offsetY = clamp(this.pose.offsetY + dy, 0, maxY)
      this.airborne = true
    }
    this.start('wiggle', 0.6)
    this.wake()
  }

  get offsetX(): number {
    return this.pose.offsetX
  }
  get offsetY(): number {
    return this.pose.offsetY
  }

  /** Advance the simulation. Returns the (mutated) smoothed pose. */
  update(rawDt: number): Pose {
    const dt = clamp(rawDt, 0, MAX_DT)
    if (dt === 0) return this.pose
    const reduced = this.config.reducedMotion
    const a = this.amp

    this.time += dt
    this.moodT += dt
    this.prevT += dt

    // 1. Base expression --------------------------------------------------
    const tgt = this.tgt
    this.applyBase(tgt, this._mood)
    const def = MOODS[this._mood]

    // 2. Mood motion layers (cross-faded) --------------------------------
    if (this.prevMood) {
      const w = smoothstep(0, 0.4, this.moodT)
      def.motion?.(tgt, this.moodT, a * w)
      if (w < 1) MOODS[this.prevMood].motion?.(tgt, this.prevT, a * (1 - w))
      else this.prevMood = null
    } else {
      def.motion?.(tgt, this.moodT, a)
    }

    // 3. Reactions --------------------------------------------------------
    for (let i = this.reactions.length - 1; i >= 0; i--) {
      const r = this.reactions[i]
      r.t += dt
      const rd = REACTIONS[r.kind]
      if (r.t >= rd.duration) {
        this.reactions.splice(i, 1)
        if (r.kind !== 'land') this.onReactionEnd?.(r.kind)
        continue
      }
      rd.apply(tgt, r.t, a, r.k)
    }

    // 4. Interaction layers ----------------------------------------------
    this.interactionLayer(tgt, def, dt, reduced, a)

    // 5. Idle layer -------------------------------------------------------
    if (this.config.idleAnimations && !reduced) this.idleLayer(tgt, def, dt, a)

    // 6. Direct channels --------------------------------------------------
    const pose = this.pose
    pose.spin = tgt.spin
    pose.blink = reduced || !this.config.idleAnimations ? 0 : tgt.blink
    this.stepLift(dt, reduced)

    // 7. Springs ----------------------------------------------------------
    this.stepSprings(dt, reduced)
    pose.beadPhase = (pose.beadPhase + (reduced ? 0 : pose.beadSpeed * dt)) % TAU

    // 8. Finalize / clamp -------------------------------------------------
    pose.eyeSmile = clamp(pose.eyeSmile, 0, 1)
    pose.eyeClosed = clamp(pose.eyeClosed, 0, 1)
    pose.eyeOpen = clamp(pose.eyeOpen, 0, 1.3)
    pose.eyeSize = clamp(pose.eyeSize, 0.6, 1.5)
    pose.glow = clamp(pose.glow, -0.5, 1)
    pose.beadGlow = clamp(pose.beadGlow, -1, 1.2)
    pose.beadRadius = Math.max(0.02, pose.beadRadius)
    pose.bodyY = Math.max(-0.05, pose.bodyY)

    this.settled = this.computeSettled(reduced)
    return pose
  }

  /* ----------------------------- internals ------------------------- */

  private wake(): void {
    this.settled = false
    this.onWake?.()
  }

  private start(kind: InternalReaction, k: number): void {
    const def = REACTIONS[kind]
    if (this.config.reducedMotion && !def.calm) {
      // Reduced motion: the mood's resting expression already says it all.
      if (kind !== 'land') this.onReactionEnd?.(kind)
      return
    }
    const existing = this.reactions.find((r) => r.kind === kind)
    if (existing) {
      if (def.uninterruptible) return
      existing.t = 0
      existing.k = k
    } else {
      this.reactions.push({ kind, t: 0, k })
    }
    this.wake()
  }

  private applyBase(out: Pose, mood: CrevoMood): void {
    const base = MOODS[mood].base
    for (let i = 0; i < POSE_KEYS.length; i++) {
      const key = POSE_KEYS[i]
      out[key] = base[key] ?? REST_VALUES[key]
    }
    // Direct accumulators start from zero every frame.
    out.spin = 0
    out.blink = 0
    out.eyeLookX = base.eyeLookX ?? 0
    out.eyeLookY = base.eyeLookY ?? 0
  }

  private interactionLayer(tgt: Pose, def: MoodDef, dt: number, reduced: boolean, a: number): void {
    const attn = (this.hovered || this.focused) && this.config.interactive ? 1 : 0
    this.hoverAmt += (attn - this.hoverAmt) * (1 - Math.exp(-dt * 9))
    this.pressAmt += ((this.pressed ? 1 : 0) - this.pressAmt) * (1 - Math.exp(-dt * 22))
    const asleep = this._mood === 'sleeping' ? 0.35 : 1

    // Expression-only parts (also valid in reduced motion).
    tgt.glow += 0.35 * this.hoverAmt * asleep
    tgt.eyeSize += 0.09 * this.hoverAmt * asleep
    tgt.eyeOpen += 0.06 * this.hoverAmt * asleep

    if (reduced) return

    // Pointer tracking.
    const idleFor = this.time - this.lastPointerAt
    const wantsPointer = this.config.trackCursor && idleFor < 4.5 ? 1 : 0
    this.pointerActive += (wantsPointer - this.pointerActive) * (1 - Math.exp(-dt * (wantsPointer ? 8 : 1.2)))
    const px = this.pointerX * this.pointerActive
    const py = this.pointerY * this.pointerActive
    const hoverBoost = 1 + 0.25 * this.hoverAmt
    tgt.eyeLookX += px * def.look * hoverBoost
    tgt.eyeLookY += py * def.look * hoverBoost
    tgt.yaw += px * 0.26 * def.lean * a
    tgt.tiltZ -= px * 0.09 * def.lean * a
    tgt.tiltX -= py * 0.08 * def.lean * a

    // Hover: perk up and lean in.
    tgt.bodyY += 0.06 * this.hoverAmt * asleep * a
    tgt.stretch += 0.04 * this.hoverAmt * asleep * a
    tgt.tiltX += 0.05 * this.hoverAmt * asleep * a
    tgt.crestPerk += 0.5 * this.hoverAmt * asleep

    // Press: compress like a squishy button.
    tgt.stretch -= 0.13 * this.pressAmt * a
    tgt.eyeSize -= 0.05 * this.pressAmt

    // Drag: held by the scruff — stretched, wide-eyed, feet dangling and swinging.
    if (this.dragging) {
      tgt.stretch += 0.1 * a
      tgt.eyeSize += 0.12
      tgt.eyeOpen += 0.1
      const swing = clamp(-this.dragVX * 0.07, -0.4, 0.4)
      tgt.tiltZ += swing * a
      tgt.crestSway += swing * 1.4 * a
      tgt.footL += 0.2 * a
      tgt.footR += 0.2 * a - swing * 0.15
    }
  }

  private idleLayer(tgt: Pose, def: MoodDef, dt: number, a: number): void {
    const w = def.idle * a
    const t = this.time

    // Breathing
    const breath = Math.sin(t * TAU * def.breath.rate)
    tgt.stretch += def.breath.depth * breath * Math.min(1, a)
    tgt.crestSway += 0.05 * Math.sin(t * TAU * def.breath.rate - 0.8) * w

    // Blinking
    if (def.blink) {
      this.nextBlink -= dt
      if (this.nextBlink <= 0 && this.blinkT < 0) {
        this.blinkT = 0
        this.nextBlink = 2.4 + this.rng() * 4.2
        this.pendingBlink = this.rng() < 0.2 ? 0.24 : -1 // occasional double blink
      }
      if (this.blinkT >= 0) {
        this.blinkT += dt
        const u = this.blinkT / 0.17
        if (u >= 1) {
          this.blinkT = -1
          if (this.pendingBlink > 0) {
            this.nextBlink = this.pendingBlink - 0.17
            this.pendingBlink = -1
          }
        } else {
          tgt.blink = u < 0.4 ? u / 0.4 : 1 - (u - 0.4) / 0.6
        }
      }
    }

    // Posture adjustments
    this.nextPosture -= dt
    if (this.nextPosture <= 0) {
      this.nextPosture = 6 + this.rng() * 8
      this.posture.z = (this.rng() - 0.5) * 0.09
      this.posture.x = (this.rng() - 0.5) * 0.06
    }
    tgt.tiltZ += this.posture.z * w
    tgt.tiltX += this.posture.x * w

    // Gaze wander (only visible while the pointer is idle)
    this.nextGaze -= dt
    if (this.nextGaze <= 0) {
      this.nextGaze = 1.6 + this.rng() * 3.2
      this.gaze.x = (this.rng() - 0.5) * 1.0
      this.gaze.y = (this.rng() - 0.5) * 0.5
    }
    const free = 1 - this.pointerActive
    tgt.eyeLookX += this.gaze.x * free * w * def.look
    tgt.eyeLookY += this.gaze.y * free * w * def.look

    // Rare playful moves — only from the neutral mood and only when left alone.
    if (this._mood === 'idle' && !this.hovered && !this.dragging && !this.pressed) {
      this.nextPlayful -= dt
      if (this.nextPlayful <= 0) {
        this.nextPlayful = 22 + this.rng() * 24
        this.start(this.rng() < 0.5 ? 'wiggle' : 'peek', 1)
      }
    }
  }

  /** Drag-following and gravity for the whole-figure lift channel. */
  private stepLift(dt: number, reduced: boolean): void {
    const pose = this.pose
    if (this.dragging) {
      let y = pose.offsetY
      const k = 900
      const c = 2 * Math.sqrt(k)
      for (let s = dt; s > 0; s -= SUBSTEP) {
        const h = Math.min(SUBSTEP, s)
        this.liftV += (k * (this.dragTY - y) - c * this.liftV) * h
        y += this.liftV * h
      }
      pose.offsetY = Math.max(0, y)
    } else if (this.airborne) {
      if (reduced) {
        pose.offsetY = 0
        this.liftV = 0
        this.airborne = false
      } else {
        let y = pose.offsetY
        for (let s = dt; s > 0; s -= SUBSTEP) {
          const h = Math.min(SUBSTEP, s)
          this.liftV -= GRAVITY * h
          y += this.liftV * h
          if (y <= 0) {
            y = 0
            const impact = -this.liftV
            if (impact > 1.2) {
              this.start('land', clamp(impact / 6, 0.3, 1.4))
              this.liftV = impact * 0.32
            } else {
              this.liftV = 0
              this.airborne = false
            }
          }
        }
        pose.offsetY = y
      }
    } else {
      pose.offsetY = 0
    }
  }

  private stepSprings(dt: number, reduced: boolean): void {
    const tgt = this.tgt
    const pose = this.pose
    // offsetX follows the drag target, or the rest position (centre if dragReturn).
    tgt.offsetX = this.dragging ? this.dragTX : this.config.dragReturn ? 0 : this.restX
    if (!this.dragging && this.config.dragReturn) this.restX = 0
    if (reduced) tgt.beadSpeed = 0

    for (let s = dt; s > 0; s -= SUBSTEP) {
      const h = Math.min(SUBSTEP, s)
      for (let i = 0; i < SPRUNG_KEYS.length; i++) {
        const key = SPRUNG_KEYS[i]
        const [w, z] = reduced ? REDUCED_SPRING : (SPRING[key] ?? DEFAULT_SPRING)
        const accel = w * w * (tgt[key] - this.x[i]) - 2 * z * w * this.v[i]
        this.v[i] += accel * h
        this.x[i] += this.v[i] * h
      }
    }
    for (let i = 0; i < SPRUNG_KEYS.length; i++) pose[SPRUNG_KEYS[i]] = this.x[i]

    // Smoothed horizontal drag velocity (world units / s) for the pendulum swing.
    const offsetIdx = SPRUNG_KEYS.indexOf('offsetX')
    this.dragVX += (this.v[offsetIdx] - this.dragVX) * (1 - Math.exp(-dt * 12))
  }

  private computeSettled(reduced: boolean): boolean {
    if (!reduced) return false
    if (this.reactions.length || this.dragging || this.airborne) return false
    let err = 0
    for (let i = 0; i < SPRUNG_KEYS.length; i++) {
      err += Math.abs(this.tgt[SPRUNG_KEYS[i]] - this.x[i]) + Math.abs(this.v[i]) * 0.05
    }
    return err < 2e-3
  }

  /** Jump straight to the current targets (used for the initial pose). */
  private snap(): void {
    SPRUNG_KEYS.forEach((k, i) => {
      this.x[i] = this.tgt[k]
      this.v[i] = 0
      this.pose[k] = this.tgt[k]
    })
  }
}
