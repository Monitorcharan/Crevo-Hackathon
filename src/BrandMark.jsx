import { Link } from 'react-router-dom'

export function BrandMark({ className = '' }) {
  return <svg className={`brand-mark ${className}`} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    {[15, 32.5, 50, 67.5, 85].map((cx, index) => <circle className="brand-mark-point" key={index} cx={cx} cy="50" r="8" />)}
  </svg>
}

export function BrandLogo({ className = '' }) {
  return <Link to="/" className={`logo ${className}`} aria-label="Crevo home"><span className="logo-word">CREVO</span></Link>
}
