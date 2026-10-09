import { BrandMark } from './BrandMark.jsx'

export default function Hero() {
  return <div className="hero-visual" aria-hidden="true">
    <div className="hero-visual-aura" />
    <div className="hero-visual-ring hero-visual-ring-one" />
    <div className="hero-visual-ring hero-visual-ring-two" />
    <div className="hero-visual-core"><BrandMark className="hero-visual-mark" /></div>
    <span className="hero-visual-note hero-visual-note-a"><i /> CREATOR</span>
    <span className="hero-visual-note hero-visual-note-b"><i /> BRAND</span>
    <span className="hero-visual-note hero-visual-note-c">BETTER WORK HAPPENS TOGETHER ↗</span>
    <span className="hero-visual-index">C / 01</span>
  </div>
}
