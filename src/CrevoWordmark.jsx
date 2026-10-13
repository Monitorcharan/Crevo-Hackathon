import { useId } from 'react'
import { motion, useMotionValue, useSpring } from 'motion/react'
import { useStudioMotion } from './StudioMotion.jsx'
import './crevo-wordmark.css'

// Live type and geometry: no image, video, or generated artwork.
export default function CrevoWordmark() {
  const { enabled } = useStudioMotion()
  const id = useId().replaceAll(':', '')
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotateX = useSpring(x, { stiffness: 65, damping: 20 })
  const rotateY = useSpring(y, { stiffness: 65, damping: 20 })
  function move(event) {
    if (!enabled || event.pointerType !== 'mouse') return
    const rect = event.currentTarget.getBoundingClientRect()
    x.set(-((event.clientY - rect.top) / rect.height - .5) * 12)
    y.set(((event.clientX - rect.left) / rect.width - .5) * 14)
  }
  return <div className="crevo-type-stage" role="img" aria-label="CREVO — ideas in motion" onPointerMove={move} onPointerLeave={() => { x.set(0); y.set(0) }}>
    <div className="crevo-type-grid"/>
    <div className="crevo-type-coordinate">C / 001 <span>IDEAS IN MOTION</span></div>
    <motion.div className="crevo-type-plane" style={{ rotateX: enabled ? rotateX : 0, rotateY: enabled ? rotateY : 0 }}>
      <svg viewBox="0 0 660 520" aria-hidden="true" className="crevo-type-svg">
        <defs><linearGradient id={`${id}-ink`} x1="0" y1="0" x2="0.7" y2="1"><stop stopColor="#f3ffd9"/><stop offset=".48" stopColor="#d7ff62"/><stop offset="1" stopColor="#87b724"/></linearGradient></defs>
        <g className="crevo-type-echoes" fill="none" stroke="#d7ff62" strokeWidth="1">
          {[-120, -80, -40, 40, 80, 120].map((offset, i) => <text key={offset} x="330" y={295 + offset} textAnchor="middle" textLength="610" lengthAdjust="spacingAndGlyphs" opacity={.1 + (3 - Math.abs(offset / 40)) * .09} style={{ '--echo-delay': `${i * -.6}s` }}>CREVO</text>)}
        </g>
        <text className="crevo-type-main" x="330" y="295" textAnchor="middle" textLength="610" lengthAdjust="spacingAndGlyphs" fill={`url(#${id}-ink)`}>CREVO</text>
        <path className="crevo-type-thread" d="M-20 380 C130 180 215 470 375 310 S530 80 690 210" fill="none" stroke="#ecffc1" strokeWidth="2"/>
        {enabled && <circle className="crevo-type-satellite" r="6" fill="#d7ff62"><animateMotion dur="9s" repeatCount="indefinite" path="M-20 380 C130 180 215 470 375 310 S530 80 690 210"/></circle>}
      </svg>
    </motion.div>
    <div className="crevo-type-baseline"><span className="studio-live"/> HUMAN IDEAS. ENDLESS POSSIBILITIES.<span>✳</span></div>
  </div>
}

export function CraftPoster({ kind }) {
  return <div className={`crevo-poster crevo-poster-${kind}`} aria-hidden="true">
    <span className="crevo-poster-index">CREVO / CREATIVE POSSIBILITIES</span>
    {kind === 'dimension' ? <><div className="crevo-wire-sphere">{Array.from({ length: 7 }, (_, i) => <i key={i} style={{ '--ring': i }}/>)}</div><strong>BEYOND<br/><em>ordinary.</em></strong><span className="crevo-poster-foot">A NEW DIMENSION OF IDEAS ↗</span></> : kind === 'type' ? <><div className="crevo-poster-type"><span>MAKE</span><span>IT <em>your</em></span><span>OWN.</span></div><div className="crevo-poster-asterisk">✳</div><span className="crevo-poster-foot">A DIFFERENT POINT OF VIEW ↗</span></> : <><div className="crevo-film-frame"><span>REC <i/></span><strong>EVERY<br/>IDEA HAS<br/><em>motion.</em></strong><span>CREVO — TAKE 001</span></div><div className="crevo-film-scan"/><span className="crevo-poster-foot">MAKE THE NEXT FRAME COUNT ↗</span></>}
  </div>
}
