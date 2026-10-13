import BrandSequence from './BrandSequence.jsx'
import { ArrowDownRight, ArrowUpRight, Clapperboard, Sparkles } from 'lucide-react'

export default function Hero() {
  return <div className="hero-visual creative-stage" aria-label="From a creative idea to a finished campaign">
    <div className="creative-stage-top"><span><i/> THE CONNECTION IN MOTION</span><span>01 — 03</span></div>
    <div className="creative-idea"><span className="creative-step">01 / THE IDEA</span><p>“Make our next launch<br/><em>impossible to scroll past.</em>”</p><span className="creative-idea-tag"><Clapperboard size={12}/> A cinematic brand film <ArrowDownRight size={15}/></span></div>
    <div className="creative-stage-center"><BrandSequence className="hero-sequence"/><span className="creative-stage-note"><Sparkles size={12}/> Your idea. The right creative mind.</span></div>
    <div className="creative-outcomes"><div className="creative-outcome"><img src="/demo/night-drive.png" alt="Illustrative cinematic night-drive concept" width="220" height="140"/><div><span>02 / FIND YOUR CREATOR</span><strong>Vision meets craft.<ArrowUpRight size={16}/></strong></div></div><div className="creative-outcome"><img src="/demo/skincare-still.png" alt="Illustrative skincare campaign concept" width="220" height="140"/><div><span>03 / MAKE IT REAL</span><strong>Something worth sharing.<ArrowUpRight size={16}/></strong></div></div></div>
    <div className="creative-stage-footer"><span>IMAGINE → CONNECT → CREATE</span><span>ILLUSTRATIVE CONCEPTS</span></div>
  </div>
}
