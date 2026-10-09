import { Link } from 'react-router-dom'

export function BrandMark({ className = '' }) {
  return <svg className={`brand-mark ${className}`} viewBox="0 0 80 80" fill="none" aria-hidden="true" focusable="false">
    <path className="brand-mark-c" d="M58 17.5C53.2 12.8 46.9 10 39.5 10C22.7 10 10 22.6 10 40s12.7 30 29.5 30c7.4 0 13.7-2.8 18.5-7.5" stroke="currentColor" strokeWidth="9" strokeLinecap="round"/>
    <circle className="brand-mark-halo" cx="64" cy="40" r="12" fill="#d5fb55"/>
    <circle className="brand-mark-dot" cx="64" cy="40" r="6.5" fill="#d5fb55"/>
  </svg>
}

export function BrandLogo({ className = '' }) {
  return <Link to="/" className={`logo ${className}`} aria-label="Crevo home"><BrandMark className="logo-mark"/><span className="logo-word">crevo</span></Link>
}
