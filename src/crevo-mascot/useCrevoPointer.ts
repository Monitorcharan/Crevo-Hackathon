import { useEffect, useRef, type RefObject } from 'react'
import { clamp, type CrevoController } from './CrevoAnimations'
import type { CrevoBridge } from './CrevoCharacter'
import type { CrevoPointerInfo } from './CrevoMascot.types'

export interface CrevoPointerCallbacks {
  onClick?: (info: CrevoPointerInfo) => void
  onHoverChange?: (hovered: boolean) => void
  onDragStart?: () => void
  onDragEnd?: (position: { x: number; y: number }) => void
}

export interface CrevoPointerOptions {
  wrapperRef: RefObject<HTMLElement | null>
  controller: CrevoController
  bridge: CrevoBridge
  /** Master switch: false while paused, off-screen, or the tab is hidden. */
  active: boolean
  interactive: boolean
  trackCursor: boolean
  draggable: boolean
  reducedMotion: boolean
  callbacks: RefObject<CrevoPointerCallbacks>
}

type Source = CrevoPointerInfo['source']

interface Press {
  id: number
  type: Source
  startX: number
  startY: number
  offsetX: number
  offsetY: number
  moved: boolean
  dragging: boolean
}

const DRAG_THRESHOLD_PX = 6

/**
 * Window-level pointer handling for the mascot.
 *
 * Why window-level instead of DOM handlers on the canvas? A transparent canvas is
 * a rectangle, but Crevo is not. Listening globally lets us:
 *   • hit-test the real silhouette (raycast) and only intercept input over Crevo,
 *   • make the eyes follow the cursor anywhere on the page,
 *   • leave touch scrolling untouched (we never preventDefault on touch).
 *
 * The wrapper has `pointer-events: none` by default; while a mouse is over the
 * silhouette we flip it to `auto` so the cursor changes and the page underneath
 * doesn't also receive the click.
 */
export function useCrevoPointer(options: CrevoPointerOptions): void {
  const optsRef = useRef(options)
  optsRef.current = options
  const { wrapperRef, controller, bridge, active, interactive } = options

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper || !active) return

    let raf = 0
    let pending: { x: number; y: number; type: Source } | null = null
    let lastPos: { x: number; y: number; type: Source } | null = null
    let hovering = false
    let press: Press | null = null
    let prevUserSelect: string | null = null

    const cb = () => optsRef.current.callbacks.current ?? {}

    /** Only mouse/pen need the wrapper to capture events; touch passes straight through. */
    const syncPointerEvents = () => {
      const t = press?.type ?? lastPos?.type ?? 'mouse'
      wrapper.style.pointerEvents = (hovering || press) && t !== 'touch' ? 'auto' : 'none'
    }

    const setHover = (h: boolean) => {
      if (hovering !== h) {
        hovering = h
        controller.setHover(h)
        wrapper.dataset.hover = h ? 'true' : 'false'
        cb().onHoverChange?.(h)
      }
      syncPointerEvents()
    }

    const processDrag = (x: number, y: number) => {
      if (!press) return
      const o = optsRef.current
      const dx = x - press.startX
      const dy = y - press.startY
      if (!press.dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
        press.moved = true
        if (o.draggable && o.interactive) {
          press.dragging = true
          press.startX = x
          press.startY = y
          press.offsetX = controller.offsetX
          press.offsetY = controller.offsetY
          controller.startDrag()
          prevUserSelect = document.body.style.userSelect
          document.body.style.userSelect = 'none'
          cb().onDragStart?.()
          return
        }
      }
      if (press.dragging) {
        const m = bridge.metrics
        controller.dragTo(
          clamp(press.offsetX + dx * m.worldPerPx, -m.maxX, m.maxX),
          clamp(press.offsetY - dy * m.worldPerPx, 0, m.maxY),
        )
      }
    }

    const flush = () => {
      raf = 0
      const p = pending
      pending = null
      if (!p) return
      const o = optsRef.current

      if (o.trackCursor && !o.reducedMotion) {
        const rect = wrapper.getBoundingClientRect()
        // Aim at roughly the character's face rather than the canvas centre.
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height * 0.55
        const reach = Math.max(260, rect.width * 1.4)
        let dx = (p.x - cx) / reach
        let dy = -(p.y - cy) / reach
        const len = Math.hypot(dx, dy)
        if (len > 1) {
          dx /= len
          dy /= len
        }
        controller.setPointer(dx, dy)
      }

      if (press) {
        processDrag(p.x, p.y)
        return
      }
      if (o.interactive && p.type !== 'touch') {
        setHover(bridge.hitTest?.(p.x, p.y) ?? false)
      }
    }

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(flush)
    }

    const onMove = (e: PointerEvent) => {
      const type = toSource(e.pointerType)
      lastPos = { x: e.clientX, y: e.clientY, type }
      pending = lastPos
      schedule()
    }

    const onDown = (e: PointerEvent) => {
      const o = optsRef.current
      if (!o.interactive || press) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (!bridge.hitTest?.(e.clientX, e.clientY)) return
      const type = toSource(e.pointerType)
      lastPos = { x: e.clientX, y: e.clientY, type }
      press = {
        id: e.pointerId,
        type,
        startX: e.clientX,
        startY: e.clientY,
        offsetX: 0,
        offsetY: 0,
        moved: false,
        dragging: false,
      }
      controller.setPress(true)
      if (type === 'touch') {
        controller.setHover(true) // touch has no hover; show attention while pressed
      } else if (o.draggable) {
        e.preventDefault() // stop the browser starting a text selection while dragging
      }
      syncPointerEvents()
    }

    const finish = (allowClick: boolean) => {
      if (!press) return
      const { dragging, moved, type } = press
      press = null
      controller.setPress(false)
      if (dragging) {
        controller.endDrag()
        if (prevUserSelect !== null) document.body.style.userSelect = prevUserSelect
        prevUserSelect = null
        cb().onDragEnd?.({ x: controller.offsetX, y: controller.offsetY })
      } else if (allowClick && !moved) {
        controller.poke()
        cb().onClick?.({ source: type })
      }
      if (type === 'touch') {
        controller.setHover(false)
        syncPointerEvents()
      } else if (lastPos) {
        // Re-evaluate hover against the character's new position.
        pending = lastPos
        schedule()
        syncPointerEvents()
      }
    }

    const onUp = (e: PointerEvent) => {
      if (press && e.pointerId === press.id) finish(true)
    }
    const onCancel = (e: PointerEvent) => {
      if (press && e.pointerId === press.id) finish(false)
    }
    const onBlur = () => finish(false)
    const onLeave = () => {
      if (!press) setHover(false)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown, { capture: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    window.addEventListener('pointercancel', onCancel, { passive: true })
    window.addEventListener('blur', onBlur)
    document.documentElement.addEventListener('pointerleave', onLeave, { passive: true })

    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown, { capture: true })
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('blur', onBlur)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      if (raf) cancelAnimationFrame(raf)
      finish(false)
      if (hovering) {
        hovering = false
        controller.setHover(false)
        cb().onHoverChange?.(false)
      }
      wrapper.style.pointerEvents = 'none'
      wrapper.dataset.hover = 'false'
    }
  }, [wrapperRef, controller, bridge, active, interactive])
}

function toSource(type: string): Source {
  return type === 'touch' ? 'touch' : type === 'pen' ? 'pen' : 'mouse'
}
