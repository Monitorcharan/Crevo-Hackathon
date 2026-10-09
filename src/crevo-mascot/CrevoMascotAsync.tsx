import { Suspense, forwardRef, lazy } from 'react'
import { CrevoMascotFallback } from './CrevoMascotFallback'
import type { CrevoMascotHandle, CrevoMascotProps } from './CrevoMascot.types'

const CrevoMascotLazy = lazy(() => import('./CrevoMascot').then((m) => ({ default: m.CrevoMascot })))

/**
 * Code-split variant: three.js + react-three-fiber (~0.8 MB) are only fetched
 * when the mascot actually renders; a CSS-only Crevo shows meanwhile.
 *
 * Import it from `components/crevo-mascot/async` (not the barrel) so the
 * bundler can keep the 3D code in its own chunk.
 */
export const CrevoMascotAsync = forwardRef<CrevoMascotHandle, CrevoMascotProps>(function CrevoMascotAsync(props, ref) {
  return (
    <Suspense
      fallback={
        <CrevoMascotFallback
          size={props.size}
          transparent={props.transparent}
          background={props.background}
          className={props.className}
          style={props.style}
        />
      }
    >
      <CrevoMascotLazy ref={ref} {...props} />
    </Suspense>
  )
})
