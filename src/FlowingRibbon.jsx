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
    const page = layer.current?.parentElement
    if (!page) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let start = 0
    let range = 1
    const draw = () => {
      frame = 0
      if (motion.matches) { layer.current.style.transform = ''; return }
      const progress = Math.max(0, Math.min(1, (window.scrollY - start) / range))
      layer.current.style.transform = `translate3d(0,${(progress * window.innerHeight * .42).toFixed(1)}px,0)`
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(draw) }
    const measure = () => {
      start = page.getBoundingClientRect().top + window.scrollY
      range = Math.max(1, page.offsetHeight - window.innerHeight)
      schedule()
    }
    const visibility = () => { if (document.hidden || motion.matches) svg.current?.pauseAnimations(); else svg.current?.unpauseAnimations() }
    const preference = () => { setReduced(motion.matches); visibility(); schedule() }
    // Two wave segments form one repeating slogan, ensuring a seamless text loop.
    setUnit(path.current.getTotalLength() / 6)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(page)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', measure)
    document.addEventListener('visibilitychange', visibility)
    motion.addEventListener('change', preference)
    preference(); measure()
    return () => {
      cancelAnimationFrame(frame); observer?.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', measure)
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
