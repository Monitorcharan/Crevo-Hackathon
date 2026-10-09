import { Link } from 'react-router-dom'

export function BrandMark({ className = '' }) {
  return <svg className={`brand-mark ${className}`} viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false">
    <path className="brand-mark-c" d="M77 24A37 37 0 1 0 77 76" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
    <circle className="brand-mark-dot" cx="85" cy="50" r="9" fill="currentColor" />
  </svg>
}

export function BrandLogo({ className = '' }) {
  return <Link to="/" className={`logo ${className}`} aria-label="Crevo home"><BrandMark className="logo-mark"/><span className="logo-word">crevo<span className="logo-period">.</span></span></Link>
}
