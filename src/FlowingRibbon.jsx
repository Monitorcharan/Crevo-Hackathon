import { useEffect, useRef, useState } from 'react'

const phrase = 'CREVO ✦ CREATE ✦ CONNECT ✦ COLLABORATE ✦ '
const wave = 'M -1200 180 Q -1050 40 -900 180 T -600 180 T -300 180 T 0 180 T 300 180 T 600 180 T 900 180 T 1200 180 T 1500 180 T 1800 180 T 2100 180 T 2400 180'

export default function FlowingRibbon() {
  const svg = useRef(null)
  const path = useRef(null)
  const layer = useRef(null)
  const [unit, setUnit] = useState(600)
  const [reduced, setReduced] = useState(true)
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let inView = true
    const visibility = () => {
      if (document.hidden || motion.matches || !inView) svg.current?.pauseAnimations()
      else svg.current?.unpauseAnimations()
      const sway = svg.current?.querySelector('.flowing-ribbon-sway')
      if (sway) sway.style.animationPlayState = document.hidden || motion.matches || !inView ? 'paused' : 'running'
    }
    const preference = () => { setReduced(motion.matches); visibility() }
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; visibility() })
    if (layer.current) observer?.observe(layer.current)
    setUnit(path.current.getTotalLength() / 6)
    document.addEventListener('visibilitychange', visibility)
    motion.addEventListener('change', preference)
    preference()
    return () => {
      observer?.disconnect()
      document.removeEventListener('visibilitychange', visibility)
      motion.removeEventListener('change', preference)
    }
  }, [])
  return <div ref={layer} className="flowing-ribbon-background" aria-hidden="true">
    <svg ref={svg} viewBox="0 0 1200 360" preserveAspectRatio="xMidYMid slice" focusable="false">
      <defs><path ref={path} id="crevo-flowing-tail-path" d={wave}/></defs>
      <g className="flowing-ribbon-sway">
        <use href="#crevo-flowing-tail-path" stroke="#D7FF45" strokeWidth="72" fill="none"/>
        {Array.from({ length: 8 }, (_, index) => <text key={index} fill="#242424" fontSize="28" fontFamily="Space Grotesk, sans-serif" fontWeight="700" dominantBaseline="central" textLength={unit} lengthAdjust="spacing">
          <textPath href="#crevo-flowing-tail-path" startOffset={index * unit}>{phrase}{!reduced && <animate attributeName="startOffset" from={index * unit} to={(index - 1) * unit} dur="14s" repeatCount="indefinite"/>}</textPath>
        </text>)}
      </g>
    </svg>
  </div>
}
