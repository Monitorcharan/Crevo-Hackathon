import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Clapperboard, Layers3, Search, Sparkles } from 'lucide-react'
import DecryptedText from './components/DecryptedText.jsx'
import CircularText from './components/CircularText.jsx'
import { ScrollVelocity } from './components/ScrollVelocity.jsx'
import TiltedCard from './components/TiltedCard.jsx'
import BorderGlow from './components/BorderGlow.jsx'
import { AmbientScene, LineReveal, Reveal, useStudioMotion } from './StudioMotion.jsx'
import { CreatorInspiration } from './CategoriesPage.jsx'
import CrevoCompanion from './CrevoCompanion.jsx'
import CrevoWordmark, { CraftPoster } from './CrevoWordmark.jsx'

const studies = [
  { kind: 'dimension', title: 'Ideas in another dimension.', category: '3D & CGI', label: '3D / MATERIAL EXPLORATION', color: 'lime' },
  { kind: 'type', title: 'A point of view. Yours.', category: 'Fashion', label: 'FASHION / ART DIRECTION', color: 'rose' },
  { kind: 'film', title: 'Make the ordinary cinematic.', category: 'AI Filmmaking', label: 'FILM / WORLDBUILDING', color: 'blue' },
]
const crafts = [ ['AI Filmmaking', 'Stories beyond the lens', '01'], ['3D & CGI', 'Reality, reimagined', '02'], ['AI Photography', 'Images with a point of view', '03'], ['Motion Design', 'Ideas that refuse to stand still', '04'] ]
const faqs = [
  ['Who is Crevo for?', 'Brands, agencies, and AI-native creators. Discover creative talent, show your process, and build a collaboration around a clear brief.'],
  ['How do I find the right creator?', 'Search the directory by craft, skills, AI tools, platform, or work type. Explore portfolios and channels before you reach out.'],
  ['What happens after I publish a brief?', 'Creators can apply with an approach. Review the applications, accept a collaborator, and continue in a shared project conversation.'],
  ['Are portfolios and tools verified?', 'Work, process, and tool details are creator reported unless marked otherwise. Public inspiration profiles are clearly separated from Crevo members.'],
]

export default function StudioLanding() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const { enabled } = useStudioMotion()
  function search(event) { event.preventDefault(); navigate(`/discover${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`) }
  return <main className="studio-landing">
    <section className="studio-hero">
      <div className="studio-hero-grid" aria-hidden="true"/><AmbientScene/>
      <div className="studio-shell studio-hero-layout">
        <div className="studio-hero-copy">
          <div className="studio-kicker"><span className="studio-live"/>{enabled ? <DecryptedText text="A NEW SPACE FOR CREATIVE CONNECTION" animateOn="view" speed={30} maxIterations={8}/> : 'A NEW SPACE FOR CREATIVE CONNECTION'}</div>
          <h1><LineReveal delay={.08}>Where ideas</LineReveal><LineReveal delay={.2}>find their</LineReveal><LineReveal delay={.32}><em>people.</em><span className="studio-heading-star" aria-hidden="true">✳</span></LineReveal></h1>
          <Reveal delay={.4}><p className="studio-hero-description">Extraordinary creators. Unconventional ideas.<br/>Your next great collaboration starts here.</p>
          <form className="studio-search" onSubmit={search}><Search size={20}/><input aria-label="Search creators" value={query} onChange={event => setQuery(event.target.value)} placeholder="What do you want to create?"/><button aria-label="Find creators"><ArrowUpRight size={22}/></button></form>
          <div className="studio-suggestions"><span>TRY</span>{['Filmmaking','3D & CGI','Photography'].map(term => <Link key={term} to={`/discover?q=${encodeURIComponent(term)}`}>{term}<ArrowUpRight size={11}/></Link>)}</div>
          <div className="studio-hero-actions"><Link className="studio-button studio-button-lime" to="/discover">Explore creators <ArrowUpRight size={20}/></Link><Link className="studio-text-link" to="/demo">Take a look around <ArrowRight size={17}/></Link></div></Reveal>
        </div>
        <Reveal className="studio-hero-art" delay={.25}>
          
          <CrevoWordmark/>
          
          <div className="studio-floating-card studio-float-top"><span className="studio-icon-chip"><Layers3 size={18}/></span><span>New tools.<br/><strong>Limitless imagination.</strong></span><Sparkles size={15}/></div>
          <div className="studio-floating-card studio-float-bottom"><span className="studio-icon-chip studio-letter-chip" aria-hidden="true">C</span><span>Made of possibilities.<small>EXPLORE AI-NATIVE TALENT</small></span><ArrowUpRight size={20}/></div>
          <Link className="studio-orbit-label" to="/categories" aria-label="Explore the creative universe">{enabled ? <CircularText text="CREATE ✦ CONNECT ✦ COLLABORATE ✦ " spinDuration={35} onHover="pause"/> : <span className="studio-static-orbit">CREATE<br/>CONNECT</span>}<ArrowUpRight size={28}/></Link>
          <span className="studio-art-note">CREVO / A CREATIVE WORK IN MOTION</span>
        </Reveal>
      </div>
      <div className="studio-shell studio-hero-foot"><a href="#studio-work"><ArrowDown size={16}/> SCROLL INTO POSSIBILITY</a><span>HUMAN IMAGINATION. NEW POSSIBILITIES.</span><span>EST. 2026 <span className="studio-mini-star">✳</span></span></div>
    </section>

    <div className="studio-ticker" aria-label="Create. Connect. Collaborate.">{enabled ? <div aria-hidden="true"><ScrollVelocity texts={['CREATE SOMETHING THAT MATTERS. ✳']} velocity={32} numCopies={4} className="studio-ticker-text"/></div> : <div className="studio-ticker-static">CREATE SOMETHING THAT MATTERS. ✳</div>}</div>

    <section id="studio-work" className="studio-work studio-shell">
      <Reveal className="studio-section-head"><div><span className="studio-kicker">01 / A WORLD OF POSSIBILITIES</span><h2>Different minds.<br/><em>Remarkable things.</em></h2></div><div><p>New dimensions. Distinct perspectives. Stories that move you. Find the people who bring them to life.</p><Link className="studio-text-link" to="/categories">Explore every craft <ArrowUpRight size={18}/></Link></div></Reveal>
      <div className="studio-study-grid">{studies.map((study, i) => <Reveal className={`studio-study studio-study-${study.color}`} delay={i * .08} key={study.title}><Link to={`/discover?category=${encodeURIComponent(study.category)}`} aria-label={`Explore ${study.category} creators`}><div className="studio-study-image">{enabled ? <TiltedCard containerHeight="100%" imageHeight="100%" imageWidth="100%" rotateAmplitude={6} scaleOnHover={1.035} showMobileWarning={false} showTooltip={false}><CraftPoster kind={study.kind}/></TiltedCard> : <CraftPoster kind={study.kind}/>}<span className="studio-study-arrow"><ArrowUpRight size={24}/></span></div><div className="studio-study-meta"><span>{study.label}</span><span>0{i + 1}</span></div><h3>{study.title}</h3></Link></Reveal>)}</div>
      <p className="studio-art-disclosure">Every craft starts with a perspective. Explore real portfolios, creative processes, and the people behind them.</p>
    </section>

    <section className="studio-craft-section"><div className="studio-shell studio-craft-layout"><Reveal className="studio-craft-intro"><span className="studio-kicker">02 / FIND YOUR FREQUENCY</span><h2>Whatever you<br/>can imagine.<br/><em>Someone can<br/>make it.</em></h2><Link className="studio-button studio-button-dark" to="/categories">All creative categories <ArrowUpRight size={19}/></Link><div className="studio-craft-symbol" aria-hidden="true">✳</div></Reveal><div className="studio-craft-list">{crafts.map(([name, description, number], index) => <Reveal delay={index * .05} key={name}><Link className="studio-craft-row" to={`/discover?category=${encodeURIComponent(name)}`}><span>{number}</span><div><h3>{name}</h3><p>{description}</p></div><ArrowUpRight size={26}/></Link></Reveal>)}<p className="studio-craft-note">From the first sketch to the final frame.<br/>Find a creative partner who gets it.</p></div></div></section>

    <section className="studio-process"><AmbientScene/><div className="studio-shell"><Reveal className="studio-section-head"><div><span className="studio-kicker">03 / LESS FRICTION. MORE CREATION.</span><h2>Great work starts<br/>with a <em>connection.</em></h2></div><Link className="studio-button studio-button-outline" to="/demo">Try the whole journey <ArrowUpRight size={20}/></Link></Reveal><div className="studio-process-grid">{[
      ['01', 'Find your people.', 'Discover creators by craft, explore their portfolios, and see how they think.', Search],
      ['02', 'Share the spark.', 'Publish a brief with your vision, goals, and budget. Invite a fresh perspective.', Clapperboard],
      ['03', 'Make it happen.', 'Review applications, choose your collaborator, and build together in one space.', Sparkles],
    ].map(([number, title, description, Icon], i) => <Reveal delay={i * .08} key={number}><BorderGlow className="studio-process-card" backgroundColor="#151915" borderRadius={22} animated={false} glowColor="78 90 65" colors={['#bde74e','#e3ffb0','#56723a']}><span className="studio-process-number">{number}</span><div className="studio-process-icon"><Icon size={32} strokeWidth={1.2}/><span/><span/></div><h3>{title}</h3><p>{description}</p></BorderGlow></Reveal>)}</div></div></section>

    <section className="studio-people studio-shell"><Reveal><CreatorInspiration limit={3}/></Reveal><Link className="studio-button studio-button-dark" to="/discover">Meet the creative community <ArrowUpRight size={20}/></Link></section>

    <section className="studio-invitation studio-shell"><Reveal className="studio-invitation-copy"><span className="studio-kicker">A LITTLE SPARK. A BIG BEGINNING.</span><h2>Good ideas<br/>deserve <em>good company.</em></h2><p>Meet the Crevo companion. A little reminder that every great project begins with curiosity—and someone to share it with.</p><div className="studio-role-links"><Link to="/join">I’m a creator <ArrowUpRight size={20}/></Link><Link to="/join">I’m a brand <ArrowUpRight size={20}/></Link></div></Reveal><Reveal className="studio-mascot"><div className="studio-mascot-ring"/><CrevoCompanion size={310} mood="greeting" interactive/><span>YOUR NEXT IDEA HAS COMPANY.</span></Reveal></section>

    <section className="studio-faq studio-shell"><Reveal><span className="studio-kicker">BEFORE WE CREATE</span><h2>A little more<br/><em>clarity.</em></h2></Reveal><div>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></section>

    <section className="studio-finale"><div className="studio-shell"><span className="studio-kicker">YOUR NEXT GREAT THING STARTS HERE</span><Reveal><h2>Let’s make<br/><span>something <em>matter.</em></span></h2></Reveal><Link to="/join" className="studio-button studio-button-dark">Find your people <ArrowUpRight size={23}/></Link><span className="studio-finale-star" aria-hidden="true">✳</span><div className="studio-finale-bottom"><span>IDEAS NEED PEOPLE.</span><span>PEOPLE NEED CREVO.</span><Check size={18}/></div></div></section>
  </main>
}
