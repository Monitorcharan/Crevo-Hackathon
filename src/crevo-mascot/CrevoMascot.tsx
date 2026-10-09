import {
  Component,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ErrorInfo,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Canvas } from '@react-three/fiber'
import { NeutralToneMapping } from 'three'
import './CrevoMascot.css'
import { CrevoController } from './CrevoAnimations'
import { CrevoCharacter, createBridge } from './CrevoCharacter'
import { CrevoMascotFallback } from './CrevoMascotFallback'
import type { CrevoMascotHandle, CrevoMascotProps } from './CrevoMascot.types'
import { useCrevoPointer, type CrevoPointerCallbacks } from './useCrevoPointer'

/* ------------------------------------------------------------------ */
/* Environment helpers                                                 */
/* ------------------------------------------------------------------ */

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function subscribeReducedMotion(onChange: () => void): () => void {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/** Live `prefers-reduced-motion` value (re-renders only when the OS setting changes). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  )
}

let webglSupport: boolean | undefined
/** Cached WebGL capability check; releases the probe context immediately. */
function isWebGLAvailable(): boolean {
  if (webglSupport !== undefined) return webglSupport
  if (typeof document === 'undefined') return true
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null
    webglSupport = !!gl
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    webglSupport = false
  }
  return webglSupport
}

class CanvasErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[CrevoMascot] WebGL scene failed, showing fallback.', error, info.componentStack)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

/**
 * Crevo, the interactive 3D mascot.
 *
 * ```tsx
 * <CrevoMascot size={180} mood="happy" interactive transparent />
 * ```
 *
 * The component is independent of routing, auth and data fetching. All
 * per-frame state lives in a {@link CrevoController}, so changing props never
 * re-creates the WebGL canvas and never re-renders the scene per frame.
 */
export const CrevoMascot = forwardRef<CrevoMascotHandle, CrevoMascotProps>(function CrevoMascot(props, ref) {
  const {
    size = 180,
    mood = 'idle',
    animationState = 'playing',
    interactive = false,
    transparent = true,
    background = '#151515',
    intensity = 1,
    reducedMotion = 'auto',
    trackCursor = true,
    idleAnimations = true,
    draggable = false,
    dragBounds = 1,
    dragReturn = false,
    zoom = 1,
    maxDpr = 2,
    playKey,
    label,
    className,
    style,
    onClick,
    onHoverChange,
    onDragStart,
    onDragEnd,
    onReactionEnd,
    onReady,
  } = props

  const wrapperRef = useRef<HTMLDivElement>(null)
  const systemReduced = usePrefersReducedMotion()
  const reduced = reducedMotion === 'auto' ? systemReduced : reducedMotion
  const [webgl] = useState(isWebGLAvailable)
  const bridge = useMemo(createBridge, [])

  // The controller owns all per-frame animation state; created once per instance.
  const [controller] = useState(() => {
    const c = new CrevoController()
    c.setConfig({
      intensity,
      reducedMotion: reduced,
      idleAnimations,
      trackCursor,
      interactive,
      dragReturn,
    })
    c.jumpTo(mood, !reduced)
    return c
  })

  /* ---- visibility: pause rendering when off-screen or the tab is hidden ---- */
  const [inView, setInView] = useState(true)
  const [tabVisible, setTabVisible] = useState(true)
  useEffect(() => {
    const el = wrapperRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: '64px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    const onVis = () => setTabVisible(document.visibilityState !== 'hidden')
    onVis()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const paused = animationState === 'paused' || !inView || !tabVisible
  const frameloop = paused ? 'never' : reduced ? 'demand' : 'always'

  /* ---- keep the controller in sync with props (no renders involved) ---- */
  useEffect(() => {
    controller.setConfig({ intensity, reducedMotion: reduced, idleAnimations, trackCursor, interactive, dragReturn })
  }, [controller, intensity, reduced, idleAnimations, trackCursor, interactive, dragReturn])

  useEffect(() => {
    controller.setMood(mood)
  }, [controller, mood])

  const firstPlayKey = useRef(true)
  useEffect(() => {
    if (firstPlayKey.current) {
      firstPlayKey.current = false
      return
    }
    controller.replay()
  }, [controller, playKey])

  const callbacks = useRef<CrevoPointerCallbacks>({})
  callbacks.current = { onClick, onHoverChange, onDragStart, onDragEnd }
  const reactionEndRef = useRef(onReactionEnd)
  reactionEndRef.current = onReactionEnd
  useEffect(() => {
    controller.onReactionEnd = (r) => reactionEndRef.current?.(r)
    return () => {
      controller.onReactionEnd = undefined
    }
  }, [controller])

  useCrevoPointer({
    wrapperRef,
    controller,
    bridge,
    active: !paused && webgl,
    interactive,
    trackCursor,
    draggable: draggable && interactive,
    reducedMotion: reduced,
    callbacks,
  })

  /* ---- drag cursor feedback (written straight to the DOM) ---- */
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    el.dataset.draggable = String(draggable && interactive)
  }, [draggable, interactive])

  useImperativeHandle(
    ref,
    () => ({
      trigger: (reaction) => controller.trigger(reaction),
      exportGLB: async () => (bridge.exportGLB ? bridge.exportGLB() : null),
      get element() {
        return wrapperRef.current
      },
    }),
    [controller, bridge],
  )

  /* ---- keyboard interaction ---- */
  const activate = () => {
    controller.poke()
    onClick?.({ source: 'keyboard' })
  }
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!(draggable && interactive)) return
    const step = 0.25
    const m = bridge.metrics
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    }
    const mv = moves[e.key]
    if (!mv) return
    e.preventDefault()
    controller.nudge(mv[0], mv[1], m.maxX, m.maxY)
  }

  const cssSize = typeof size === 'number' ? `${size}px` : size
  const classes = ['crevo-mascot', className].filter(Boolean).join(' ')
  const wrapperStyle = {
    width: cssSize,
    height: cssSize,
    background: transparent ? undefined : background,
    ...style,
  }

  const fallback = <CrevoMascotFallback size="100%" transparent />

  return (
    <div
      ref={wrapperRef}
      className={classes}
      style={wrapperStyle}
      data-mood={mood}
      data-transparent={transparent}
      data-reduced-motion={reduced}
      data-paused={paused}
      aria-hidden={interactive ? undefined : true}
    >
      {webgl ? (
        <CanvasErrorBoundary fallback={fallback}>
          <Canvas
            frameloop={frameloop}
            dpr={[1, maxDpr]}
            camera={{ fov: 28, near: 0.1, far: 40, position: [0, 2.3, 11] }}
            gl={{ alpha: true, antialias: true, powerPreference: 'default' }}
            resize={{ scroll: false, debounce: 0 }}
            style={{ pointerEvents: 'none', width: '100%', height: '100%' }}
            onCreated={({ gl }) => {
              gl.toneMapping = NeutralToneMapping // keeps the electric lime saturated
              gl.setClearColor(0x000000, 0)
              const canvas = gl.domElement
              canvas.addEventListener('webglcontextlost', (e) => e.preventDefault())
              canvas.addEventListener('webglcontextrestored', () => bridge.invalidate?.())
            }}
          >
            <CrevoCharacter controller={controller} bridge={bridge} zoom={zoom} dragBounds={dragBounds} onReady={onReady} />
          </Canvas>
        </CanvasErrorBoundary>
      ) : (
        fallback
      )}

      {interactive && (
        <button
          type="button"
          className="crevo-mascot__button"
          aria-label={label ?? `Crevo mascot, currently ${mood}. Press to play.`}
          onClick={activate}
          onKeyDown={onKeyDown}
          onFocus={(e) => controller.setFocus(e.currentTarget.matches(':focus-visible'))}
          onBlur={() => controller.setFocus(false)}
        />
      )}
    </div>
  )
})
