import type { CSSProperties } from 'react'

/** Every expression / behaviour state Crevo can be put into through the `mood` prop. */
export type CrevoMood =
  | 'idle'
  | 'happy'
  | 'thinking'
  | 'listening'
  | 'surprised'
  | 'success'
  | 'error'
  | 'sleeping'
  | 'greeting'
  | 'working'

export const CREVO_MOODS: readonly CrevoMood[] = [
  'idle',
  'happy',
  'thinking',
  'listening',
  'surprised',
  'success',
  'error',
  'sleeping',
  'greeting',
  'working',
] as const

/**
 * One-shot reactions that play on top of the current mood and always run to
 * completion (so e.g. a celebratory spin can never end half-turned).
 */
export type CrevoReaction = 'click' | 'startle' | 'celebrate' | 'wiggle' | 'peek'

/** `paused` stops the render loop entirely (the last frame stays on screen). */
export type CrevoAnimationState = 'playing' | 'paused'

export interface CrevoPointerInfo {
  /** Pointer type that caused the event (mouse, touch, pen, or keyboard). */
  source: 'mouse' | 'touch' | 'pen' | 'keyboard'
}

export interface CrevoMascotProps {
  /**
   * Edge length of the (square) canvas. Numbers are CSS pixels; strings are any
   * CSS length (e.g. `"100%"`, `"12rem"`). Default `180`.
   */
  size?: number | string
  /** Controlled mood. Changing it cross-fades the animation, it never remounts WebGL. */
  mood?: CrevoMood
  /** `paused` halts the render loop. Default `playing`. */
  animationState?: CrevoAnimationState
  /**
   * Enables hover / click / drag / keyboard behaviour. When `false` Crevo is purely
   * decorative: `aria-hidden`, not focusable, never intercepts pointer input.
   */
  interactive?: boolean
  /** Transparent canvas (page shows through). Default `true`. */
  transparent?: boolean
  /** Background colour used when `transparent` is `false`. Default `#151515`. */
  background?: string
  /** Global animation strength. `0` = calm expression only, `1` = default, up to `2`. */
  intensity?: number
  /**
   * `'auto'` follows the OS `prefers-reduced-motion` setting. `true` forces the calm
   * static state, `false` forces full motion.
   */
  reducedMotion?: boolean | 'auto'
  /** Eyes + body follow the pointer (anywhere on the page). Default `true`. */
  trackCursor?: boolean
  /** Breathing, blinking, posture shifts and rare playful moves. Default `true`. */
  idleAnimations?: boolean
  /** Allow dragging inside the canvas area. Requires `interactive`. Default `false`. */
  draggable?: boolean
  /** Fraction (0–1) of the free space inside the canvas that dragging may use. Default `1`. */
  dragBounds?: number
  /** After a drop, slide back to the centre instead of staying where dropped. Default `false`. */
  dragReturn?: boolean
  /**
   * Camera zoom. `1` frames the character tightly (good for icons); values below `1`
   * leave empty space around Crevo for hopping and dragging.
   */
  zoom?: number
  /** Upper bound for device pixel ratio. Default `2` (use `1.5` or `1` on low-end targets). */
  maxDpr?: number
  /** Change this value to replay the one-shot entry animation of the current mood. */
  playKey?: string | number
  /** Accessible name (only used when `interactive`). */
  label?: string
  className?: string
  style?: CSSProperties

  onClick?: (info: CrevoPointerInfo) => void
  onHoverChange?: (hovered: boolean) => void
  onDragStart?: () => void
  onDragEnd?: (position: { x: number; y: number }) => void
  /** Fired when a one-shot reaction (`click`, `celebrate`, …) finishes. */
  onReactionEnd?: (reaction: CrevoReaction) => void
  /** Fired once the WebGL scene has rendered its first frame. */
  onReady?: () => void
}

/** Imperative handle exposed through `ref`. */
export interface CrevoMascotHandle {
  /** Play a one-shot reaction on top of the current mood. */
  trigger: (reaction: CrevoReaction) => void
  /**
   * Export the character (rest pose, without the shadow) as a binary glTF.
   * Resolves `null` if the scene is not ready.
   */
  exportGLB: () => Promise<ArrayBuffer | null>
  /** The wrapper element. */
  readonly element: HTMLDivElement | null
}
