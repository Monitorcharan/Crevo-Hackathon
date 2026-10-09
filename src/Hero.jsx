import { BrandMark } from './BrandMark.jsx'

export default function Hero() {
  return <div className="hero-visual" aria-hidden="true">
    <div className="hero-visual-glow"/>
    <div className="hero-orbit hero-orbit-outer"/>
    <div className="hero-orbit hero-orbit-inner"/>
    <div className="hero-connection hero-connection-a"/>
    <div className="hero-connection hero-connection-b"/>
    <div className="hero-visual-center"><BrandMark className="hero-center-mark"/><span>CREATIVE ENERGY<br/>CONNECTED</span></div>

    <div className="hero-tile hero-tile-creator">
      <div className="hero-tile-label"><span className="hero-status-dot"/> CREATOR / 001</div>
      <div className="hero-artwork"><span className="hero-artwork-sun"/><span className="hero-artwork-arch"/><span className="hero-artwork-shine"/></div>
      <div className="hero-tile-foot"><span>Maya Chen<strong>Visual storyteller</strong></span><span className="hero-tile-arrow">↗</span></div>
    </div>

    <div className="hero-tile hero-tile-brief">
      <div className="hero-tile-label">BRAND BRIEF <span>● OPEN</span></div>
      <div className="hero-brief-icon"><span/><span/><span/></div>
      <strong>Make something<br/>unforgettable.</strong>
      <div className="hero-brief-bottom"><span>CAMPAIGN / 024</span><span>↗</span></div>
    </div>

    <div className="hero-tile hero-tile-match">
      <span className="hero-tile-label">THE RIGHT CONNECTION</span>
      <div className="hero-match-row"><div className="hero-match-score">96<span>%</span></div><div><strong>It's a match.</strong><span>Storytelling · Fashion · Film</span></div></div>
      <div className="hero-match-meter"><span/></div>
    </div>
    <span className="hero-spark hero-spark-one">✳</span><span className="hero-spark hero-spark-two">✳</span>
  </div>
}
