import type { CSSProperties } from 'react'
import './CrevoMascot.css'

/**
 * Lightweight CSS-only Crevo (no three.js). Used as the Suspense fallback of the
 * lazy-loaded mascot and when WebGL is unavailable or fails.
 */
export function CrevoMascotFallback({
  size = 180,
  transparent = true,
  background = '#151515',
  className,
  style,
}: {
  size?: number | string
  transparent?: boolean
  background?: string
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      aria-hidden="true"
      className={['crevo-mascot', 'crevo-mascot--fallback', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, background: transparent ? undefined : background, ...style }}
    >
      <div className="crevo-fallback">
        <span className="crevo-fallback__crest" />
        <span className="crevo-fallback__crest crevo-fallback__crest--minor" />
        <span className="crevo-fallback__body">
          <i className="crevo-fallback__eye" />
          <i className="crevo-fallback__eye" />
        </span>
      </div>
    </div>
  )
}
