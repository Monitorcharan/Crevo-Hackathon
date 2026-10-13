import { useEffect, useRef } from 'react'

const bands = Array.from({ length: 16 }, (_, i) => {
  const x = 45 + i * 43
  return `M ${x} -70 C ${x - 75} 110 ${x + 190} 170 ${x + 105} 360 C ${x + 30} 530 ${x - 180} 550 ${x - 90} 830 L ${x - 60} 830 C ${x - 150} 550 ${x + 60} 530 ${x + 135} 360 C ${x + 220} 170 ${x - 45} 110 ${x + 30} -70 Z`
})

export default function LandingRibbons() {
  const layer = useRef(null)
  const ribbonFlow = useRef(null)
  useEffect(() => {
    const page = layer.current?.parentElement
    if (!page) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let top = 0
    let range = 1
    const draw = () => {
      frame = 0
      if (document.hidden) return
      const progress = Math.max(0, Math.min(1, (window.scrollY - top) / range))
      ribbonFlow.current?.setAttribute('transform', reduced.matches ? 'translate(0 0)' : `translate(0 ${(-progress * 140).toFixed(2)})`)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(draw) }
    const measure = () => {
      top = page.getBoundingClientRect().top + window.scrollY
      range = Math.max(1, page.offsetHeight - window.innerHeight)
      schedule()
    }
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    resize?.observe(page)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', measure)
    document.addEventListener('visibilitychange', schedule)
    reduced.addEventListener('change', schedule)
    measure()
    return () => {
      cancelAnimationFrame(frame)
      resize?.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', measure)
      document.removeEventListener('visibilitychange', schedule)
      reduced.removeEventListener('change', schedule)
    }
  }, [])
  return <div ref={layer} className="landing-ribbon-background" aria-hidden="true">
    <svg className="landing-ribbon-svg" viewBox="0 0 900 760" fill="none" focusable="false">
      <defs>
        <linearGradient id="landing-ribbon-metal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#181d13"/><stop offset=".15" stopColor="#546034"/><stop offset=".38" stopColor="#c5db87"/><stop offset=".47" stopColor="#f2f7de"/><stop offset=".55" stopColor="#d7ff45"/><stop offset=".72" stopColor="#7c992d"/><stop offset="1" stopColor="#252b1b"/>
        </linearGradient>
        <linearGradient id="landing-ribbon-fade" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="white" stopOpacity="0"/><stop offset=".2" stopColor="white"/><stop offset=".75" stopColor="white"/><stop offset="1" stopColor="white" stopOpacity="0"/>
        </linearGradient>
        <mask id="landing-ribbon-mask"><rect width="900" height="760" fill="url(#landing-ribbon-fade)"/></mask>
      </defs>
      <g mask="url(#landing-ribbon-mask)">
        <g ref={ribbonFlow}>
        <g >{bands.map((d, index) => <path key={index} d={d} fill="url(#landing-ribbon-metal)" opacity={.4 + index / 32} />)}</g>
        <g  transform="translate(100 20)"><path d="M 150 -30 C 10 230 810 220 580 490 S 210 670 390 840" stroke="#d7ff45" strokeWidth="1" opacity=".45"/><path d="M 170 -30 C 30 230 830 220 600 490 S 230 670 410 840" stroke="#e8efdc" strokeWidth="1" opacity=".2"/></g>
        </g>
      </g>
    </svg>
  </div>
}
