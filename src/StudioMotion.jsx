import { Component, createContext, lazy, Suspense, useContext, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { Pause, Play } from 'lucide-react'
import CountUp from './components/CountUp.jsx'

const Iridescence = lazy(() => import('./components/Iridescence.jsx'))
const MotionContext = createContext({ enabled: true, toggle: () => {} })
export const useStudioMotion = () => useContext(MotionContext)

export function AnimatedNumber({ to, ...props }) {
  const { enabled } = useStudioMotion()
  return enabled ? <CountUp to={to} {...props}/> : <span>{to}</span>
}

export function StudioMotionProvider({ children }) {
  const reduced = useReducedMotion()
  const [paused, setPaused] = useState(() => { try { return localStorage.getItem('crevo-motion') === 'paused' } catch { return false } })
  const enabled = !reduced && !paused
  useEffect(() => { document.documentElement.dataset.studioMotion = enabled ? 'on' : 'off' }, [enabled])
  const toggle = () => setPaused(current => { try { localStorage.setItem('crevo-motion', current ? 'on' : 'paused') } catch {} return !current })
  return <MotionContext.Provider value={{ enabled, toggle, reduced }}>{children}</MotionContext.Provider>
}

export function MotionToggle() {
  const { enabled, toggle, reduced } = useStudioMotion()
  return <button className="studio-motion-toggle" onClick={toggle} disabled={reduced} aria-label={reduced ? 'Reduced motion is enabled in your system' : enabled ? 'Pause visual animations' : 'Resume visual animations'} title={reduced ? 'System reduced motion' : enabled ? 'Pause visual animations' : 'Resume visual animations'}>{enabled ? <Pause size={14}/> : <Play size={14}/>}<span>Motion</span></button>
}

export function Reveal({ children, className = '', delay = 0, as = 'div' }) {
  const { enabled } = useStudioMotion()
  const Element = as === 'section' ? motion.section : motion.div
  return <Element className={className} initial={enabled ? { opacity: 0, y: 32 } : false} animate={!enabled ? { opacity: 1, y: 0 } : undefined} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .12 }} transition={{ duration: enabled ? .8 : 0, delay: enabled ? delay : 0, ease: [.22, 1, .36, 1] }}>{children}</Element>
}

export function LineReveal({ children, delay = 0 }) {
  const { enabled } = useStudioMotion()
  return <span className="studio-line"><motion.span initial={enabled ? { y: '108%', rotate: 3 } : false} animate={{ y: 0, rotate: 0 }} transition={{ duration: enabled ? 1 : 0, delay: enabled ? delay : 0, ease: [.22, 1, .36, 1] }}>{children}</motion.span></span>
}

class SceneBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? null : this.props.children }
}

export function AmbientScene({ className = '' }) {
  const ref = useRef(null)
  const visible = useInView(ref, { margin: '100px' })
  const { enabled } = useStudioMotion()
  const [active, setActive] = useState(!document.hidden)
  useEffect(() => { const change = () => setActive(!document.hidden); document.addEventListener('visibilitychange', change); return () => document.removeEventListener('visibilitychange', change) }, [])
  return <div ref={ref} className={`studio-ambient ${className}`} aria-hidden="true">{visible && enabled && active && <SceneBoundary><Suspense fallback={null}><Iridescence color={[.65, .9, .3]} speed={.35} amplitude={.12} mouseReact={false} resolution={.65} detail={5}/></Suspense></SceneBoundary>}</div>
}

// One delegated pointer listener serves the real cards on every existing page.
export function StudioPageMotion() {
  const { pathname } = useLocation()
  const { enabled } = useStudioMotion()
  useEffect(() => {
    document.body.classList.toggle('studio-home', pathname === '/')
    if (!enabled) return
    let frame = 0
    let target = null
    const move = event => {
      if (event.pointerType !== 'mouse') return
      const card = event.target.closest('.studio-hover, .creator-inspiration-card, .creator-card, .project-card, .gig-card, .work-card, .dash-panel')
      if (!card) return
      const { clientX, clientY } = event
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        target = card
        const rect = card.getBoundingClientRect()
        card.style.setProperty('--studio-x', `${clientX - rect.left}px`)
        card.style.setProperty('--studio-y', `${clientY - rect.top}px`)
      })
    }
    document.addEventListener('pointermove', move, { passive: true })
    return () => { cancelAnimationFrame(frame); document.removeEventListener('pointermove', move); target?.style.removeProperty('--studio-x'); target?.style.removeProperty('--studio-y') }
  }, [pathname, enabled])
  useEffect(() => {
    if (!enabled || pathname === '/') return
    const seen = new WeakSet()
    const animations = new Set()
    const selector = '.page-head, .categories-heading, .dash-top, .judge-heading, .profile-content, .public-creator-copy, .portfolio-content > h1, .brief-builder-content > h1, .creator-inspiration-card, .directory-grid .creator-card, .project-card, .gig-card, .work-card, .judge-panel, .dash-panel'
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return
      observer.unobserve(entry.target)
      const animation = entry.target.animate([{ opacity: 0, translate: '0 24px' }, { opacity: 1, translate: '0 0' }], { duration: 700, easing: 'cubic-bezier(.22,1,.36,1)' })
      animations.add(animation)
      animation.onfinish = () => animations.delete(animation)
    }), { threshold: .06 })
    let scheduled = 0
    const scan = () => { scheduled = 0; document.querySelectorAll(selector).forEach(element => { if (!seen.has(element)) { seen.add(element); observer.observe(element) } }) }
    const changes = new MutationObserver(records => { if (records.some(record => record.addedNodes.length) && !scheduled) scheduled = requestAnimationFrame(scan) })
    changes.observe(document.getElementById('root'), { childList: true, subtree: true })
    scan()
    return () => { cancelAnimationFrame(scheduled); changes.disconnect(); observer.disconnect(); animations.forEach(animation => animation.cancel()) }
  }, [pathname, enabled])
  return null
}
