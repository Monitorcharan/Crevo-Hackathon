import { CrevoMascotAsync } from './crevo-mascot/async'
import { useStudioMotion } from './StudioMotion.jsx'

export default function CrevoCompanion({ size = 280, mood = 'greeting', interactive = false, className = '' }) {
  const { enabled } = useStudioMotion()
  return <CrevoMascotAsync
    size={size}
    mood={mood}
    animationState={enabled ? 'playing' : 'paused'}
    reducedMotion={!enabled}
    interactive={interactive && enabled}
    trackCursor={interactive && enabled}
    transparent
    maxDpr={1.5}
    className={className}
    label="Crevo mascot. Press to make Crevo bounce."
  />
}
