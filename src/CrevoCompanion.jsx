import { CrevoMascotAsync } from './crevo-mascot/async'

export default function CrevoCompanion({ size = 280, mood = 'greeting', interactive = false, className = '' }) {
  return <CrevoMascotAsync
    size={size}
    mood={mood}
    interactive={interactive}
    trackCursor={interactive}
    transparent
    maxDpr={1.5}
    className={className}
    label="Crevo mascot. Press to make Crevo bounce."
  />
}
