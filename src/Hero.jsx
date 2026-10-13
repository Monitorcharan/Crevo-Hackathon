import { useEffect, useRef, useState } from 'react'
import BrandSequence from './BrandSequence.jsx'

const bands = Array.from({ length: 16 }, (_, i) => {
  const x = 45 + i * 43
  return `M ${x} -70 C ${x - 75} 110 ${x + 190} 170 ${x + 105} 360 C ${x + 30} 530 ${x - 180} 550 ${x - 90} 830 L ${x - 60} 830 C ${x - 150} 550 ${x + 60} 530 ${x + 135} 360 C ${x + 220} 170 ${x - 45} 110 ${x + 30} -70 Z`
})

export default function Hero() {
  const stage = useRef(null)
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    let inView = true
    const update = () => setPlaying(inView && document.visibilityState !== 'hidden')
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; update() })
    if (observer && stage.current) observer.observe(stage.current)
    document.addEventListener('visibilitychange', update)
    update()
    return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', update) }
  }, [])
  return <div ref={stage} className={`hero-visual ribbon-stage ${playing ? 'ribbon-stage-playing' : ''}`} aria-hidden="true">
    <svg className="crevo-ribbons" viewBox="0 0 900 760" fill="none" focusable="false">
      <defs>
        <linearGradient id="crevo-ribbon-metal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#181d13"/><stop offset=".15" stopColor="#546034"/><stop offset=".38" stopColor="#c5db87"/><stop offset=".47" stopColor="#f2f7de"/><stop offset=".55" stopColor="#d7ff45"/><stop offset=".72" stopColor="#7c992d"/><stop offset="1" stopColor="#252b1b"/>
        </linearGradient>
        <linearGradient id="crevo-ribbon-fade" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="white" stopOpacity="0"/><stop offset=".2" stopColor="white"/><stop offset=".75" stopColor="white"/><stop offset="1" stopColor="white" stopOpacity="0"/>
        </linearGradient>
        <mask id="crevo-ribbon-mask"><rect width="900" height="760" fill="url(#crevo-ribbon-fade)"/></mask>
      </defs>
      <g mask="url(#crevo-ribbon-mask)">
        <g className="ribbon-weave">{bands.map((d, index) => <path key={index} d={d} fill="url(#crevo-ribbon-metal)" opacity={.4 + index / 32} />)}</g>
        <g className="ribbon-echo" transform="translate(100 20)"><path d="M 150 -30 C 10 230 810 220 580 490 S 210 670 390 840" stroke="#d7ff45" strokeWidth="1" opacity=".45"/><path d="M 170 -30 C 30 230 830 220 600 490 S 230 670 410 840" stroke="#e8efdc" strokeWidth="1" opacity=".2"/></g>
      </g>
    </svg>
    <div className="ribbon-wordmark"><BrandSequence className="hero-sequence"/></div>
    <div className="ribbon-signature"><span/> CREATIVE ENERGY, IN MOTION</div>
  </div>
}
