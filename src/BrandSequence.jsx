import { useId } from 'react'
import { BrandMark } from './BrandMark.jsx'

const positions = [178, 319, 460, 601, 742]

export default function BrandSequence({ className = '' }) {
  const maskId = `crevo-loader-${useId().replace(/:/g, '')}`
  return <div className={`brand-sequence ${className}`} aria-hidden="true">
    <svg className="loader-svg" viewBox="0 0 920 430" preserveAspectRatio="xMidYMid meet" focusable="false">
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="920" height="430">
          <rect width="920" height="430" fill="black" />
          {positions.map((cx, index) => <circle className="loader-reveal" key={cx} cx={cx} cy="215" r="0" fill="white" style={{ animationDelay: `${3.05 + index * .16}s` }} />)}
        </mask>
      </defs>
      <text className="loader-word" x="460" y="282" textAnchor="middle" mask={`url(#${maskId})`}>CREVO</text>
      <g className="loader-dots">
        {positions.map((cx, index) => <circle className="loader-dot" key={cx} cx={cx} cy="215" r="17" style={{
          '--slope': `${(index - 2) * 14}px`,
          '--opposite': `${(2 - index) * 14}px`,
          animationDelay: `${index * .13}s, ${3.05 + index * .16}s`,
        }} />)}
      </g>
    </svg>
    <BrandMark className="sequence-mobile-mark" />
  </div>
}
