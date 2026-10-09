import { BrandMark } from './BrandMark.jsx'

const letters = [
  { glyph: 'C', dotX: 178, letterX: 226 },
  { glyph: 'R', dotX: 319, letterX: 347 },
  { glyph: 'E', dotX: 460, letterX: 460 },
  { glyph: 'V', dotX: 601, letterX: 570 },
  { glyph: 'O', dotX: 742, letterX: 691 },
]

export default function BrandSequence({ className = '' }) {
  return <div className={`brand-sequence ${className}`} aria-hidden="true">
    <svg className="loader-svg" viewBox="0 0 920 430" preserveAspectRatio="xMidYMid meet" focusable="false">
      <g className="loader-letters">
        {letters.map(({ glyph, dotX, letterX }, index) => <text
          className="loader-letter"
          key={glyph}
          x={letterX}
          y="282"
          textAnchor="middle"
          style={{
            '--origin-shift': `${dotX - letterX}px`,
            animationDelay: `${3.04 + index * .12}s`,
          }}
        >{glyph}</text>)}
      </g>
      <g className="loader-dots">
        {letters.map(({ dotX, letterX }, index) => <circle className="loader-dot" key={dotX} cx={dotX} cy="215" r="17" style={{
          '--slope': `${(index - 2) * 14}px`,
          '--opposite': `${(2 - index) * 14}px`,
          '--travel-mid': `${(letterX - dotX) * .7}px`,
          '--travel': `${letterX - dotX}px`,
          animationDelay: `${index * .13}s, ${3.04 + index * .12}s`,
        }} />)}
      </g>
    </svg>
    <BrandMark className="sequence-mobile-mark" />
  </div>
}
