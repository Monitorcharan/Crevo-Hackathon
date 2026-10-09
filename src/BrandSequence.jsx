import { useId } from 'react'
import { BrandMark } from './BrandMark.jsx'

const nodes = [
  [116, 118], [116, 313], [176, 118], [176, 313],
  [266, 117], [266, 315], [328, 117], [328, 315],
  [419, 117], [419, 315], [482, 117], [482, 315],
  [580, 117], [580, 315], [644, 117], [644, 315],
  [738, 117], [738, 315], [799, 117], [799, 315],
]
const revealPoints = [210, 377, 544, 711]

export default function BrandSequence({ className = '' }) {
  const maskId = `crevo-reveal-${useId().replace(/:/g, '')}`
  return <div className={`brand-sequence ${className}`} aria-hidden="true">
    <svg className="sequence-svg" viewBox="0 0 920 430" preserveAspectRatio="xMidYMid meet" focusable="false">
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="920" height="430">
          <rect width="920" height="430" fill="black" />
          {revealPoints.map((x, index) => <circle className="sequence-reveal" key={index} cx={x} cy="215" r="0" fill="white" />)}
        </mask>
      </defs>
      <g className="sequence-guides">
        <path d="M0 117H920M0 215H920M0 315H920" />
        <path d="M116 84V345M266 84V345M419 84V345M580 84V345M738 84V345" />
      </g>
      <g className="sequence-wire">
        <text x="460" y="280" textAnchor="middle">crevo</text>
        <path className="sequence-baseline" d="M67 315H852" />
        {nodes.map(([x, y], index) => <circle key={index} cx={x} cy={y} r="4" />)}
      </g>
      <text className="sequence-solid" x="460" y="280" textAnchor="middle" mask={`url(#${maskId})`}>crevo</text>
      <g className="sequence-dots">
        <circle cx="443" cy="197" r="14" />
        <circle cx="477" cy="197" r="14" />
        <circle cx="443" cy="231" r="14" />
        <circle cx="477" cy="231" r="14" />
      </g>
    </svg>
    <BrandMark className="sequence-mobile-mark" />
    <span className="sequence-caption">CREATIVE ENERGY, CONNECTED</span>
  </div>
}
