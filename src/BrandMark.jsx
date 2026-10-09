import { Link } from 'react-router-dom'

export function BrandMark({ className = '' }) {
  return <svg className={`brand-mark ${className}`} viewBox="0 0 80 80" aria-hidden="true" focusable="false">
    <circle className="brand-mark-point" cx="28" cy="28" r="11" />
    <circle className="brand-mark-point" cx="52" cy="28" r="11" />
    <circle className="brand-mark-point" cx="28" cy="52" r="11" />
    <circle className="brand-mark-point" cx="52" cy="52" r="11" />
  </svg>
}

export function BrandLogo({ className = '' }) {
  return <Link to="/" className={`logo ${className}`} aria-label="Crevo home"><span className="logo-word">crevo</span></Link>
}
