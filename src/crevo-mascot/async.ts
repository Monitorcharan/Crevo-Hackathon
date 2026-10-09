/**
 * Code-split entry point: keeps three.js out of your main bundle.
 *   import { CrevoMascotAsync } from '@/components/crevo-mascot/async'
 */
export { CrevoMascotAsync } from './CrevoMascotAsync'
export { CrevoMascotFallback } from './CrevoMascotFallback'
export { CREVO_MOODS } from './CrevoMascot.types'
export type {
  CrevoAnimationState,
  CrevoMascotHandle,
  CrevoMascotProps,
  CrevoMood,
  CrevoPointerInfo,
  CrevoReaction,
} from './CrevoMascot.types'
