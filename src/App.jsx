import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { ArrowRight, ArrowUpRight, Aperture, Box, BriefcaseBusiness, Check, ChevronDown, CirclePlus, Clapperboard, Compass, Film, Instagram, Layers3, Menu, MessageCircle, Search, Send, Sparkles, UserRound, WandSparkles, X } from 'lucide-react'
import { SiInstagram, SiFacebook, SiX, SiYoutube, SiReddit } from 'react-icons/si'
import { api, authMode, setAuthMode, setToken, token } from './api.js'
import { firebaseSignOut } from './firebaseAuth.js'
import SocialSignIn from './SocialSignIn.jsx'
import BrandProfile from './BrandProfile.jsx'
import CreatorContact from './CreatorContact.jsx'
import Inbox from './Inbox.jsx'
import { AdminVerifications, CreatorReviews, ProjectReview, VerificationRequestPanel, VerifiedBadge } from './CreatorTrust.jsx'
import { categories } from './categories.js'
import { demoFeedbackFor } from './demoReviews.js'
import CategoriesPage from './CategoriesPage.jsx'
import { BrandLogo, BrandMark } from './BrandMark.jsx'
import BrandSequence from './BrandSequence.jsx'
import CrevoCompanion from './CrevoCompanion.jsx'

const Hero = lazy(() => import('./Hero.jsx'))

const platforms = ['Instagram', 'TikTok', 'YouTube']
const tones = ['tone-1', 'tone-2', 'tone-3', 'tone-4', 'tone-5', 'tone-6']
const formatAudience = n => n >= 1000 ? `${Math.round(n / 1000)}k` : n
const currency = n => `$${Number(n || 0).toLocaleString()}`
const socialPlatforms = [{ key: 'instagram', label: 'Instagram', Icon: SiInstagram }, { key: 'facebook', label: 'Facebook', Icon: SiFacebook }, { key: 'x', label: 'X', Icon: SiX }, { key: 'youtube', label: 'YouTube', Icon: SiYoutube }, { key: 'reddit', label: 'Reddit', Icon: SiReddit }]

function useRequest(path, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: '' })
  useEffect(() => {
    let active = true
    setState(s => ({ ...s, loading: true, error: '' }))
    api(path).then(data => active && setState({ data, loading: false, error: '' })).catch(e => active && setState({ data: null, loading: false, error: e.message }))
    return () => { active = false }
  }, deps)
  return state
}

function Logo() { return <BrandLogo/> }
function Pill({ children, lime = false }) { return <span className={`pill ${lime ? 'pill-lime' : ''}`}>{children}</span> }
function Empty({ title, detail, action }) { return <div className="empty"><div className="empty-icon"><Sparkles size={24}/></div><h3>{title}</h3><p>{detail}</p>{action}</div> }
function Alert({ error }) { return error && <div className="alert" role="alert">{error}</div> }
function Primary({ children, ...props }) { return <button className="button button-primary" {...props}>{children}</button> }

function RevealSection({ children, className, id }) {
  const reducedMotion = useReducedMotion()
  return <motion.section id={id} className={className} initial={reducedMotion ? false : { opacity: 0, y: 34 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.08 }} transition={{ duration: .8, ease: [.22, 1, .36, 1] }}>{children}</motion.section>
}

function moveCraftCard(event) {
  if (event.pointerType !== 'mouse') return
  const card = event.currentTarget
  const rect = card.getBoundingClientRect()
  card.style.setProperty('--card-x', `${((event.clientX - rect.left) / rect.width - .5) * 5}deg`)
  card.style.setProperty('--card-y', `${(.5 - (event.clientY - rect.top) / rect.height) * 5}deg`)
}

function resetCraftCard(event) {
  event.currentTarget.style.removeProperty('--card-x')
  event.currentTarget.style.removeProperty('--card-y')
}

function Nav({ session, onLogout, dark }) {
  const [open, setOpen] = useState(false)
  return <header className={`nav ${dark ? 'nav-dark' : ''}`}><div className="container nav-inner"><Logo/><nav className={open ? 'nav-links open' : 'nav-links'}>
    <NavLink to="/categories" onClick={() => setOpen(false)}>Categories</NavLink>
    <NavLink to="/discover" onClick={() => setOpen(false)}>Discover creators</NavLink>
    {session?.user?.role === 'creator' && <NavLink to="/opportunities" onClick={() => setOpen(false)}>Opportunities</NavLink>}
    {session?.user?.role === 'creator' && <NavLink to="/portfolio/edit" onClick={() => setOpen(false)}>My portfolio</NavLink>}
    {session && <NavLink to="/inbox" onClick={() => setOpen(false)}>Inbox</NavLink>}
    {session && <NavLink to="/dashboard" onClick={() => setOpen(false)}>Dashboard</NavLink>}
    {session?.is_admin && <NavLink to="/admin/verifications" onClick={() => setOpen(false)}>Verifications</NavLink>}
    {!session && <><NavLink className="mobile-auth-link" to="/login" onClick={() => setOpen(false)}>Log in</NavLink><NavLink className="mobile-auth-link" to="/join" onClick={() => setOpen(false)}>Get started</NavLink></>}
  </nav><div className="nav-actions">{session ? <><span className="nav-greeting">Hi, {session.user.name.split(' ')[0]}</span><button className="text-button" onClick={onLogout}>Log out</button></> : <><Link className="text-button" to="/login">Log in</Link><Link className="button button-small button-light" to="/join">Get started <ArrowUpRight size={15}/></Link></>}</div><button className="mobile-menu" aria-label="Toggle menu" onClick={() => setOpen(!open)}>{open ? <X/> : <Menu/>}</button></div></header>
}

const craftCards = [
  { name: 'AI filmmakers', detail: 'Films with a point of view', query: 'Video', Icon: Clapperboard, art: 'film' },
  { name: 'Motion & 3D', detail: 'Worlds built in motion', query: 'Motion', Icon: Box, art: 'motion' },
  { name: 'Campaign imagery', detail: 'Visuals made to stand out', query: 'Photography', Icon: Aperture, art: 'image' },
  { name: 'Social content', detail: 'Ideas made for the feed', query: 'UGC', Icon: Layers3, art: 'social' },
]

function ExploreCrafts() {
  return <RevealSection className="craft-section" id="explore"><div className="container"><div className="landing-section-head"><div><span className="eyebrow">EXPLORE BY CRAFT</span><h2>Find the kind of<br/><em>magic you need.</em></h2></div><p>From a cinematic launch film to a scroll-stopping campaign, start with the work you want to make.</p></div><div className="craft-grid">{craftCards.map(({ name, detail, query, Icon, art }, index) => <Link key={name} to={`/discover?q=${encodeURIComponent(query)}`} className={`craft-card craft-${art}`} onPointerMove={moveCraftCard} onPointerLeave={resetCraftCard}><span className="craft-card-top"><span>0{index + 1} / CREATIVE CRAFT</span><ArrowUpRight size={20}/></span><span className="craft-art" aria-hidden="true"><Icon strokeWidth={1.2}/></span><span className="craft-card-bottom"><strong>{name}</strong><small>{detail}</small></span></Link>)}</div><div className="craft-footer"><span>Explore every creative specialty in one place.</span><Link to="/categories">View all categories <ArrowUpRight size={16}/></Link></div></div></RevealSection>
}

function MascotSpotlight() {
  return <RevealSection className="mascot-spotlight"><div className="container mascot-spotlight-inner"><div className="mascot-stage"><CrevoCompanion size={340} mood="greeting" interactive/></div><div className="mascot-spotlight-copy"><span className="eyebrow">MEET THE CREVO MASCOT</span><h2>A little spark for<br/><em>big ideas.</em></h2><p>Our lemon-green creative companion brings a bit of energy to every new connection. Give Crevo a click and say hello.</p><Link className="button button-primary" to="/categories">Explore creative categories <ArrowUpRight size={17}/></Link></div></div></RevealSection>
}

function WorkProof() {
  return <RevealSection className="workproof-section"><div className="container workproof-grid"><div className="workproof-copy"><span className="eyebrow">MORE THAN A PRETTY PICTURE</span><h2>See the work.<br/><em>Understand the craft.</em></h2><p>Crevo portfolios give brands a closer look at what went into each piece. Explore the finished result alongside the tools, process, format, and commercial-use details that matter to a real campaign.</p><div className="workproof-points"><div><span>01</span><div><strong>Tools & models</strong><p>See the AI and production tools a creator reports using.</p></div></div><div><span>02</span><div><strong>Workflow & output</strong><p>Understand how an idea became the final image, film, or animation.</p></div></div><div><span>03</span><div><strong>Usage clarity</strong><p>Review format and commercial-use terms before starting a conversation.</p></div></div></div><Link className="button button-primary" to="/discover">Explore portfolios <ArrowUpRight size={17}/></Link></div><div className="workproof-visual"><div className="workproof-image"><img src="/demo/skincare-still.png" alt="Illustrative AI-generated skincare product concept"/><span>ILLUSTRATIVE PROJECT</span></div><div className="workproof-note"><span>INSIDE AN AI PORTFOLIO</span><div><strong>Tool stack</strong><small>Models & editing tools</small></div><div><strong>Process</strong><small>From concept to delivery</small></div><div><strong>Use rights</strong><small>Creator-reported terms</small></div></div></div></div></RevealSection>
}

function Journey() {
  const steps = [
    ['01', 'Discover the talent', 'Search by craft, skill, tools, and the kind of work a creator has made.'],
    ['02', 'Shape your brief', 'Set the content type, style, format, budget, and commercial-use needs.'],
    ['03', 'Find your fit', 'Review applications and ranked suggestions with clear reasons behind each match.'],
    ['04', 'Make it together', 'Accept a creator and keep your project conversation in one place.'],
  ]
  return <RevealSection className="journey-section" id="how-it-works"><div className="container"><div className="landing-section-head"><div><span className="eyebrow">HOW CREVO WORKS</span><h2>From first spark<br/><em>to final frame.</em></h2></div><p>A simple path from finding the right person to making something worth sharing.</p></div><div className="journey-grid">{steps.map(([number, title, detail]) => <article key={number}><span>{number}</span><div className="journey-line"/><h3>{title}</h3><p>{detail}</p></article>)}</div><div className="journey-action"><Link className="button button-dark" to="/join">Start a project <ArrowUpRight size={17}/></Link><Link className="journey-text-link" to="/discover">Or explore creators first <ArrowRight size={16}/></Link></div></div></RevealSection>
}

function AudiencePaths() {
  return <RevealSection className="audience-section"><div className="container audience-grid"><article className="audience-brand"><span className="eyebrow">FOR BRANDS & AGENCIES</span><div><h2>Bring the idea.<br/>Find your people.</h2><p>Discover AI-native talent, make a brief that captures what you need, and move from application to collaboration with clarity.</p><Link to="/join?role=brand">Start as a brand <ArrowUpRight size={18}/></Link></div><BriefcaseBusiness aria-hidden="true" className="audience-watermark"/></article><article className="audience-creator"><span className="eyebrow">FOR CREATORS</span><div><h2>Let the work<br/>speak louder.</h2><p>Build a profile that shows your craft and process, share your portfolio and channels, and find briefs worth pitching.</p><Link to="/join">Join as a creator <ArrowUpRight size={18}/></Link></div><Film aria-hidden="true" className="audience-watermark"/></article></div></RevealSection>
}

function LandingFaq() {
  const items = [
    ['How do I find the right creator?', 'Browse the directory or search by skill, specialty, AI tools, and portfolio content type. Brands can also publish a brief and review ranked matches.'],
    ['What can I see in an AI portfolio?', 'Each work sample can include the finished media, tools and models, workflow notes, output format, and commercial-use information.'],
    ['Are tools and past work verified?', 'Portfolio and tool details are creator reported. Crevo labels them clearly so you can ask follow-up questions before an engagement.'],
    ['What happens after I publish a brief?', 'Creators can apply with a note. You can review applicants, accept one, and continue in a shared project conversation.'],
  ]
  return <RevealSection className="landing-faq"><div className="container faq-grid"><div><span className="eyebrow">GOOD TO KNOW</span><h2>A few things<br/><em>worth knowing.</em></h2><p>Clear details make better collaborations.</p></div><div className="faq-list">{items.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></div></RevealSection>
}

function Landing() {
  const { data: creators } = useRequest('/creators', [])
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const pointerFrame = useRef(0)
  const [query, setQuery] = useState('')
  useEffect(() => () => cancelAnimationFrame(pointerFrame.current), [])
  function moveHero(event) {
    if (reducedMotion || event.pointerType !== 'mouse') return
    const hero = event.currentTarget
    const rect = hero.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    cancelAnimationFrame(pointerFrame.current)
    pointerFrame.current = requestAnimationFrame(() => {
      hero.style.setProperty('--pointer-x', `${x}px`)
      hero.style.setProperty('--pointer-y', `${y}px`)
      hero.style.setProperty('--hero-shift-x', `${(x / rect.width - .5) * 22}px`)
      hero.style.setProperty('--hero-shift-y', `${(y / rect.height - .5) * 16}px`)
      hero.style.setProperty('--hero-light-opacity', '1')
    })
  }
  function resetHero(event) {
    cancelAnimationFrame(pointerFrame.current)
    const hero = event.currentTarget
    hero.style.setProperty('--hero-shift-x', '0px')
    hero.style.setProperty('--hero-shift-y', '0px')
    hero.style.setProperty('--hero-light-opacity', '0')
  }
  function searchCreators(event) { event.preventDefault(); navigate(`/discover${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`) }
  return <><section className="hero" onPointerMove={moveHero} onPointerLeave={resetHero}><Suspense fallback={<div className="hero-fallback"/>}><Hero/></Suspense><div className="hero-pointer-light" aria-hidden="true"/><div className="hero-grain"/><div className="container hero-content"><motion.div initial={reducedMotion ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7 }}><div className="eyebrow hero-eyebrow"><span className="live-dot"/> THE CREATIVE CONNECTION PLATFORM</div><h1>Where ideas<br/><em>find their people.</em></h1><p>Find remarkable AI creators, see how they work, and make the next great thing together.</p><form className="hero-search" onSubmit={searchCreators}><Search size={21} aria-hidden="true"/><input aria-label="Search AI creators" placeholder="Try video, motion, Runway, photography…" value={query} onChange={event => setQuery(event.target.value)}/><button type="submit">Find creators <ArrowUpRight size={17}/></button></form><div className="hero-suggestions"><span>POPULAR:</span>{['Video', 'Motion', 'Photography', 'UGC'].map(term => <Link key={term} to={`/discover?q=${encodeURIComponent(term)}`}>{term}</Link>)}</div><div className="hero-actions"><Link to="/discover" className="button button-primary">Explore creators <ArrowUpRight size={18}/></Link><Link to="/join" className="button button-outline">Join the community <ArrowRight size={18}/></Link></div></motion.div></div><div className="hero-bottom container"><span>SCROLL TO EXPLORE</span><span>CREATIVE ENERGY, CONNECTED ↘</span></div></section>
    <ExploreCrafts/><MascotSpotlight/>
    <RevealSection className="intro-section"><div className="container"><div className="section-top"><div><span className="eyebrow">01 / THE PLATFORM</span><h2>Great work starts<br/>with the right people<span className="accent">.</span></h2></div><p>Crevo brings AI-native talent and ambitious brands into the same room. Discover, pitch, match and collaborate in one place.</p></div><div className="feature-grid"><article><span className="feature-number">01</span><Compass size={30}/><h3>Find your fit</h3><p>Explore creators by craft, audience and platform, or get ranked suggestions for your brief.</p></article><article><span className="feature-number">02</span><WandSparkles size={30}/><h3>Make your mark</h3><p>Give your work a home with a profile and portfolio you can shape to tell your story.</p></article><article><span className="feature-number">03</span><MessageCircle size={30}/><h3>Build together</h3><p>Move from application to project conversation without losing the thread.</p></article></div></div></RevealSection>
    <WorkProof/>
    <RevealSection className="featured-section"><div className="container"><div className="section-heading"><div><span className="eyebrow">02 / CREATOR SPOTLIGHT</span><h2>People making<br/>things happen<span className="accent">.</span></h2></div><Link className="round-link" to="/discover" aria-label="Explore all creators"><ArrowUpRight/></Link></div><div className="creator-grid">{creators?.length ? creators.slice(0, 3).map((c,i) => <CreatorCard key={c.id} creator={c} index={i}/>) : <Empty title="A new creative community" detail="Creator spotlights will appear as members build their profiles." action={<Link className="button button-dark" to="/join">Join as a creator <ArrowRight size={16}/></Link>}/>}</div></div></RevealSection>
    <Journey/><AudiencePaths/><LandingFaq/>
    <RevealSection className="cta-section"><div className="container cta-inner"><span className="eyebrow">YOUR NEXT BIG IDEA STARTS HERE</span><h2>Let’s make<br/><em>something matter.</em></h2><Link to="/join" className="button button-dark">Get started <ArrowUpRight/></Link><BrandMark className="cta-mark"/></div></RevealSection></>
}

function Avatar({ creator, index = 0, large = false }) {
  return <div className={`avatar-art ${tones[index % tones.length]} ${large ? 'avatar-large' : ''}`}>
    {creator.portfolio_source === 'demo' && creator.portfolio_image ? <><img src={creator.portfolio_image} alt={`Illustrative demo artwork for ${creator.name}`}/><span className="demo-art-label">DEMO ARTWORK</span></> : creator.avatar_url ? <img src={creator.avatar_url} alt={creator.name}/> : <><span className="avatar-orb"/><span className="avatar-initials">{creator.name.split(' ').map(x => x[0]).slice(0,2).join('')}</span></>}
  </div>
}

function CreatorCard({ creator, index }) {
  const samples = demoFeedbackFor(creator)
  return <div className="creator-card"><Link to={`/creators/${creator.id}`} className="card-image"><Avatar creator={creator} index={index}/><span className="card-arrow"><ArrowUpRight size={18}/></span></Link><div className="card-info"><div><Link to={`/creators/${creator.id}`}><h3>{creator.name}</h3></Link><VerifiedBadge verifiedAt={creator.verified_at}/><p>{creator.title}</p></div><span>{creator.location}</span></div><div className="card-tags">{creator.categories.slice(0,2).map(x => <Pill key={x}>{x}</Pill>)}{(creator.portfolio_tools || []).slice(0,1).map(x => <Pill key={x}>{x}</Pill>)}{creator.portfolio_source !== 'demo' && <Pill>{formatAudience(creator.audience)} audience</Pill>}{samples.length > 0 && <Pill>★ Sample feedback · {samples.length}</Pill>}{creator.review_count > 0 && <Pill>★ {creator.rating_average} · {creator.review_count} reviews</Pill>}</div><Link className="portfolio-card-link" to={`/creators/${creator.id}/work`}>View AI portfolio <ArrowUpRight size={15}/></Link></div>
}

function Discover() {
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('q') || ''), [category, setCategory] = useState(searchParams.get('category') || 'All'), [platform, setPlatform] = useState(''), [skill, setSkill] = useState(''), [tool, setTool] = useState(''), [contentType, setContentType] = useState('')
  useEffect(() => { setSearch(searchParams.get('q') || ''); setCategory(searchParams.get('category') || 'All') }, [searchParams])
  const { data, loading, error } = useRequest('/creators', [])
  const choices = useMemo(() => {
    const unique = values => [...new Set(values)].sort((a, b) => a.localeCompare(b))
    return { skills: unique((data || []).flatMap(c => c.skills)), tools: unique((data || []).flatMap(c => c.portfolio_tools || [])), contentTypes: unique((data || []).flatMap(c => c.content_types || [])) }
  }, [data])
  const results = useMemo(() => (data || []).filter(c => (!search || [c.name, c.title, c.bio, c.location, ...c.skills, ...c.categories, ...(c.portfolio_tools || [])].join(' ').toLowerCase().includes(search.toLowerCase())) && (category === 'All' || c.categories.includes(category)) && (!platform || c.platforms.includes(platform)) && (!skill || c.skills.includes(skill)) && (!tool || (c.portfolio_tools || []).includes(tool)) && (!contentType || (c.content_types || []).includes(contentType))), [data, search, category, platform, skill, tool, contentType])
  const filtered = Boolean(search || category !== 'All' || platform || skill || tool || contentType)
  const reset = () => { setSearch(''); setCategory('All'); setPlatform(''); setSkill(''); setTool(''); setContentType('') }
  return <main className="page-light"><div className="container page-head"><span className="eyebrow">THE CREATIVE DIRECTORY</span><h1>Meet your next<br/><em>favorite collaborator.</em></h1><p>Discover creators who make ideas impossible to ignore.</p></div>
    <div className="container discover-controls"><label className="search-box"><Search size={20}/><input aria-label="Search creators" placeholder="Search by name, skill, tool or location" value={search} onChange={e => setSearch(e.target.value)}/></label><label className="select-box">Platform <select value={platform} onChange={e => setPlatform(e.target.value)}><option value="">All platforms</option>{platforms.map(x => <option key={x}>{x}</option>)}</select><ChevronDown size={16}/></label></div>
    <div className="container discover-extra-filters"><label>Category<select aria-label="Filter by category" value={category} onChange={e => setCategory(e.target.value)}>{categories.map(x => <option key={x}>{x}</option>)}</select></label><label>Skill<select aria-label="Filter by skill" value={skill} onChange={e => setSkill(e.target.value)}><option value="">All skills</option>{choices.skills.map(x => <option key={x}>{x}</option>)}</select></label><label>AI tool / model<select aria-label="Filter by AI tool or model" value={tool} onChange={e => setTool(e.target.value)}><option value="">All tools</option>{choices.tools.map(x => <option key={x}>{x}</option>)}</select></label><label>Content type<select aria-label="Filter by content type" value={contentType} onChange={e => setContentType(e.target.value)}><option value="">All content types</option>{choices.contentTypes.map(x => <option key={x} value={x}>{x === 'image' ? 'Images / graphics' : x === 'video' ? 'Video / animation' : 'Other work links'}</option>)}</select></label></div>
    <div className="container results-line"><span>{results.length} CREATORS</span>{filtered ? <button className="clear-filters" onClick={reset}>Clear filters</button> : <span>CURATED FOR CONNECTION</span>}</div>
    <div className="container creator-grid directory-grid">{loading ? <p>Loading creators…</p> : error ? <Alert error={error}/> : results.length ? results.map((c,i) => <CreatorCard key={c.id} creator={c} index={i}/>) : <Empty title={data?.length ? 'No creators found' : 'Be the first creator'} detail={data?.length ? 'Try another search or clear the filters.' : 'Join Crevo and create a profile to appear here.'} action={data?.length ? <button className="button button-dark" onClick={reset}>Clear filters</button> : <Link className="button button-dark" to="/join">Create a profile <ArrowRight size={16}/></Link>}/>}</div>
  </main>
}

function SocialLinks({ links }) {
  const available = socialPlatforms.filter(({ key }) => links?.[key])
  if (!available.length) return null
  return <div className="profile-group"><span>FIND ME ONLINE</span><div className="social-links">{available.map(({ key, label, Icon }) => <a key={key} className="social-link" href={links[key]} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${label} profile`} title={label}><Icon aria-hidden="true"/></a>)}</div></div>
}

function CreatorProfile({ session }) {
  const { id } = useParams()
  const { data: c, loading, error } = useRequest(`/creators/${id}`, [id])
  if (loading) return <main className="page-light loading">Loading profile…</main>
  if (error) return <main className="page-light loading"><Alert error={error}/></main>
  const samples = demoFeedbackFor(c)
  return <main className="page-light"><div className="container profile-layout"><div className="profile-visual"><Avatar creator={c} large/></div><div className="profile-content"><Link to="/discover" className="back-link">← All creators</Link><div className="eyebrow">{c.portfolio_source === 'demo' ? 'ILLUSTRATIVE DEMO PROFILE' : 'CREATOR PROFILE'} / {c.location || 'WORLDWIDE'}</div><h1>{c.name}<span className="accent">.</span></h1><VerifiedBadge verifiedAt={c.verified_at}/><h2>{c.title}</h2><p className="profile-bio">{c.bio || 'This creator is shaping their story. Check back soon.'}</p>{c.portfolio_source !== 'demo' && <div className="profile-stats"><div><strong>{formatAudience(c.audience)}</strong><span>AUDIENCE</span></div><div><strong>{currency(c.rate)}</strong><span>STARTING RATE</span></div>{c.review_count > 0 && <div><strong>★ {c.rating_average}</strong><span>{c.review_count} PROJECT REVIEWS</span></div>}</div>}<div className="profile-group"><span>CREATIVE FOCUS</span><div>{c.categories.map(x => <Pill key={x}>{x}</Pill>)}{c.skills.map(x => <Pill key={x}>{x}</Pill>)}</div></div><div className="profile-group"><span>PLATFORMS</span><div>{c.platforms.map(x => <Pill key={x}>{x}</Pill>)}</div></div><SocialLinks links={c.social_links}/>{c.portfolio && <div className="portfolio"><span className="eyebrow">PORTFOLIO INTRO · {c.portfolio_source === 'demo' ? 'ILLUSTRATIVE DEMO' : ['openai', 'gemini'].includes(c.portfolio_source) ? 'AI ASSISTED' : c.portfolio_source === 'template' ? 'TEMPLATE DRAFT' : 'CREATOR WRITTEN'}</span><p>{c.portfolio}</p></div>}{c.portfolio_source !== 'demo' && <CreatorContact creator={c} session={session}/>}<Link to={c.portfolio_source === 'demo' ? `/creators/${c.id}/work` : session?.user?.role === 'brand' ? '/briefs/new' : session?.user?.role === 'creator' ? '/opportunities' : '/join'} className="button button-dark">{c.portfolio_source === 'demo' ? 'Explore demo portfolio' : session?.user?.role === 'brand' ? 'Create a brief' : session?.user?.role === 'creator' ? 'Explore opportunities' : 'Join Crevo'} <ArrowUpRight size={18}/></Link></div></div><CreatorReviews creatorId={c.id} rating={c.rating_average} count={c.review_count} demoReviews={samples}/></main>
}

function Auth({ onAuth, mode }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [role, setRole] = useState(searchParams.get('role') === 'brand' ? 'brand' : 'creator'), [name, setName] = useState(''), [companyName, setCompanyName] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [notice, setNotice] = useState('')
  const join = mode === 'join'
  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true)
    try {
      const result = await api(join ? '/auth/register' : '/auth/login', { method: 'POST', body: join ? { role, name, company_name: role === 'brand' ? companyName.trim() : '', email, password } : { email, password } })
      if (result.email_confirmation_required) { setNotice('Check your email to confirm your account, then log in.'); return }
      await firebaseSignOut(); setToken(result.access_token); setAuthMode('supabase'); onAuth(result); navigate('/dashboard')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <main className="auth-page"><div className="auth-art"><Logo/><div className="auth-art-inner"><span className="eyebrow">CREATIVE ENERGY, CONNECTED</span><h2>Better together.<br/><em>Always.</em></h2><div className="auth-brand-visual" aria-hidden="true"><CrevoCompanion size={280} mood="happy" className="auth-mascot"/></div></div></div><div className="auth-panel"><div className="auth-box"><span className="eyebrow">{join ? 'JOIN THE COMMUNITY' : 'WELCOME BACK'}</span><h1>{join ? 'Make your move.' : 'Good to see you.'}</h1><p>{join ? 'Create your space to discover, connect and collaborate.' : 'Log in to pick up where the creativity left off.'}</p>{join && <div className="role-switch"><button className={role === 'creator' ? 'selected' : ''} onClick={() => setRole('creator')} type="button"><UserRound size={17}/> I’m a creator</button><button className={role === 'brand' ? 'selected' : ''} onClick={() => setRole('brand')} type="button"><BriefcaseBusiness size={17}/> I’m a brand</button></div>}<form onSubmit={submit}>{join && <label>Your full name<input required minLength={2} maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Your name"/></label>}{join && role === 'brand' && <label>Brand or company name<input required minLength={2} maxLength={120} value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="The name creators will see"/></label>}<label>Email address<input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters"/></label><Alert error={error}/>{notice && <div className="notice">{notice}</div>}<Primary type="submit" disabled={busy}>{busy ? 'Please wait…' : join ? 'Create account' : 'Log in'} <ArrowRight size={18}/></Primary></form><SocialSignIn role={join ? role : undefined} companyName={join && role === 'brand' ? companyName : ''} onAuth={onAuth}/><div className="auth-footer">{join ? 'Already a member?' : 'New to Crevo?'} <Link to={join ? '/login' : '/join'}>{join ? 'Log in' : 'Join now'}</Link></div></div></div></main>
}

function Protected({ session, children }) { return session ? children : <Navigate to="/login" replace/> }

function Dashboard({ session, refresh }) {
  return <main className="page-light dashboard"><div className="container dash-top"><div><span className="eyebrow">YOUR CREATIVE SPACE</span><h1>Hey, {session.user.name.split(' ')[0]}<span className="accent">.</span></h1><p>{session.user.role === 'brand' ? 'Your next great collaboration starts here.' : 'Your next opportunity is waiting.'}</p></div><Pill lime>{session.user.role.toUpperCase()} ACCOUNT</Pill></div>{session.user.role === 'brand' ? <BrandDashboard user={session.user}/> : <CreatorDashboard refresh={refresh}/>}<div className="container">{authMode() !== 'firebase' && <SocialSignIn connect/>}</div></main>
}

function BrandDashboard({ user }) {
  const { data: briefs, error, loading } = useRequest('/briefs', [])
  const { data: applications } = useRequest('/applications', [])
  const { data: projects } = useRequest('/projects', [])
  return <div className="container dash-content"><div className="brand-identity-card"><div className="brand-identity-logo">{user.logo_url ? <img src={user.logo_url} alt={`${user.company_name || 'Brand'} logo`}/> : <span aria-hidden="true">{(user.company_name || user.name).slice(0,2).toUpperCase()}</span>}</div><div><span className="eyebrow">YOUR BRAND</span><h2>{user.company_name || 'Add your company name'}</h2><p>Let creators know who is behind your briefs.</p></div><Link className="button button-outline-dark" to="/brand/profile">Edit brand profile <ArrowUpRight size={17}/></Link></div><div className="dash-stats"><div><strong>{briefs?.length || 0}</strong><span>YOUR BRIEFS</span></div><div><strong>{applications?.length || 0}</strong><span>APPLICATIONS</span></div><div><strong>{projects?.filter(p => p.status === 'active').length || 0}</strong><span>ACTIVE PROJECTS</span></div></div><div className="dash-section-head"><div><span className="eyebrow">YOUR CAMPAIGNS</span><h2>Briefs & projects</h2></div><Link to="/briefs/new" className="button button-dark"><CirclePlus size={17}/> Create a brief</Link></div><Alert error={error}/>{loading ? <p>Loading briefs…</p> : briefs?.length ? <div className="brief-list">{briefs.map(b => <Link className="brief-row" to={`/briefs/${b.id}`} key={b.id}><div><span className="eyebrow">{b.category} / {b.status}</span><h3>{b.title}</h3><p>{b.description}</p></div><div><strong>{currency(b.budget)}</strong><ArrowUpRight/></div></Link>)}</div> : <Empty title="Bring your idea to life" detail="Create a brief to share what you’re imagining and meet creators who can make it real." action={<Link to="/briefs/new" className="button button-dark">Create your first brief <ArrowRight size={18}/></Link>}/>}<div className="dash-section-head space-top"><div><span className="eyebrow">IN MOTION</span><h2>Collaborations</h2></div></div>{projects?.length ? <div className="project-grid">{projects.map(p => <Link className="project-card" to={`/projects/${p.id}`} key={p.id}><span className="eyebrow">{p.status.toUpperCase()} PROJECT</span><h3>{p.brief.title}</h3><p>With {p.creator.name}</p><ArrowUpRight/></Link>)}</div> : <p className="muted">Accept a creator application to start a project.</p>}</div>
}

function CreatorDashboard({ refresh }) {
  const { data: profile, error } = useRequest('/me', [refresh])
  const { data: applications } = useRequest('/applications', [])
  const { data: projects } = useRequest('/projects', [])
  return <div className="container dash-content"><div className="dash-stats"><div><strong>{profile?.creator?.skills.length || 0}</strong><span>PROFILE SKILLS</span></div><div><strong>{applications?.length || 0}</strong><span>APPLICATIONS</span></div><div><strong>{projects?.filter(p => p.status === 'active').length || 0}</strong><span>ACTIVE PROJECTS</span></div></div><Alert error={error}/><div className="dashboard-two"><div className="dash-panel"><span className="eyebrow">YOUR PRESENCE</span><h2>Make an impression.</h2><p>Keep your profile current so brands understand your craft.</p><Link to="/profile/edit" className="button button-dark">Edit your profile <ArrowUpRight size={18}/></Link>{profile?.creator && <Link className="under-link" to={`/creators/${profile.creator.id}`}>View public profile →</Link>}</div><div className="dash-panel dash-panel-dark"><span className="eyebrow">OPEN OPPORTUNITIES</span><h2>Good things are out there.</h2><p>Browse briefs and show a brand what you can bring.</p><Link to="/opportunities" className="button button-primary">Explore briefs <ArrowUpRight size={18}/></Link></div></div><div className="dash-section-head space-top"><div><span className="eyebrow">IN MOTION</span><h2>Your collaborations</h2></div></div>{projects?.length ? <div className="project-grid">{projects.map(p => <Link className="project-card" to={`/projects/${p.id}`} key={p.id}><span className="eyebrow">{p.status.toUpperCase()} PROJECT</span><h3>{p.brief.title}</h3><p>With the brand</p><ArrowUpRight/></Link>)}</div> : <p className="muted">Projects appear here when a brand accepts your application.</p>}</div>
}

function csv(value) { return value.split(',').map(x => x.trim()).filter(Boolean) }
function BriefForm() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ title: '', description: '', category: 'Lifestyle', skills: '', platforms: '', budget: '', location: '' }), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))
  async function submit(e) { e.preventDefault(); setBusy(true); setError(''); try { const b = await api('/briefs', { method: 'POST', body: { ...form, skills: csv(form.skills), platforms: csv(form.platforms), budget: Number(form.budget) } }); navigate(`/briefs/${b.id}`) } catch (e) { setError(e.message) } finally { setBusy(false) } }
  return <main className="page-light form-page"><div className="container narrow"><Link className="back-link" to="/dashboard">← Dashboard</Link><span className="eyebrow">THE START OF SOMETHING GOOD</span><h1>Create a brief<span className="accent">.</span></h1><p>Tell creators what you’re building and what success looks like.</p><form className="editor-form" onSubmit={submit}><label>Project title<input required minLength={4} value={form.title} onChange={e => set('title', e.target.value)} placeholder="A name that captures the idea"/></label><label>The idea<textarea required minLength={20} rows={6} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Share the goal, deliverables, tone and anything creators should know"/></label><div className="form-two"><label>Category<select value={form.category} onChange={e => set('category', e.target.value)}>{categories.slice(1).map(c => <option key={c}>{c}</option>)}</select></label><label>Budget (USD)<input required min="0" type="number" value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="2500"/></label></div><div className="form-two"><label>Skills needed<input value={form.skills} onChange={e => set('skills', e.target.value)} placeholder="Video, Photography"/><small>Separate with commas</small></label><label>Platforms<input value={form.platforms} onChange={e => set('platforms', e.target.value)} placeholder="Instagram, TikTok"/><small>Separate with commas</small></label></div><label>Location preference<input value={form.location} onChange={e => set('location', e.target.value)} placeholder="Optional — e.g. London"/></label><Alert error={error}/><Primary disabled={busy}>{busy ? 'Publishing…' : 'Publish brief'} <ArrowRight size={18}/></Primary></form></div></main>
}

function BriefDetail({ session }) {
  const { id } = useParams()
  const { data: brief, loading, error } = useRequest(`/briefs/${id}`, [id])
  const { data: matches } = useRequest(session?.user?.role === 'brand' ? `/briefs/${id}/matches` : '/health', [id])
  const { data: applications } = useRequest('/applications', [id])
  const [note, setNote] = useState(''), [status, setStatus] = useState(''), [actionError, setActionError] = useState(''), [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  async function apply(e) { e.preventDefault(); setBusy(true); setActionError(''); try { await api(`/briefs/${id}/apply`, { method: 'POST', body: { note } }); setStatus('Application sent. You can track it on your dashboard.') } catch (e) { setActionError(e.message) } finally { setBusy(false) } }
  async function accept(applicationId) { setBusy(true); setActionError(''); try { const p = await api(`/applications/${applicationId}/accept`, { method: 'POST' }); navigate(`/projects/${p.id}`) } catch (e) { setActionError(e.message) } finally { setBusy(false) } }
  if (loading) return <main className="page-light loading">Loading brief…</main>
  if (error) return <main className="page-light loading"><Alert error={error}/></main>
  const owned = session?.user?.id === brief.owner_id
  const related = (applications || []).filter(a => a.brief_id === id)
  return <main className="page-light"><div className="container brief-detail"><div><Link className="back-link" to={owned ? '/dashboard' : '/opportunities'}>← {owned ? 'Dashboard' : 'Opportunities'}</Link><span className="eyebrow">{brief.category} / {brief.status}</span><h1>{brief.title}<span className="accent">.</span></h1><p className="brief-description">{brief.description}</p><div className="brief-meta"><div><span>BUDGET</span><strong>{currency(brief.budget)}</strong></div><div><span>LOCATION</span><strong>{brief.location || 'Flexible'}</strong></div></div><div className="profile-group"><span>LOOKING FOR</span><div>{brief.skills.map(x => <Pill key={x}>{x}</Pill>)}{brief.platforms.map(x => <Pill key={x}>{x}</Pill>)}</div></div>{!owned && <div className="apply-panel"><span className="eyebrow">MAKE YOUR CASE</span><h2>Apply to this brief</h2><form onSubmit={apply}><textarea required minLength={20} rows={5} value={note} onChange={e => setNote(e.target.value)} placeholder="Tell the brand why you’re a great fit and how you’d approach the project"/><Alert error={actionError}/>{status && <div className="notice">{status}</div>}<Primary disabled={busy || Boolean(status)}>Send application <Send size={17}/></Primary></form></div>}</div><aside className="brief-side">{owned ? <><span className="eyebrow">EXPLAINABLE MATCHING</span><h2>Suggested creators</h2><p>Ranked by category, skills, platforms, budget and location. Scores are transparent rules, not AI predictions.</p><div className="match-list">{(matches || []).slice(0,5).map((m,i) => <Link to={`/creators/${m.creator.id}`} key={m.creator.id} className="match"><div className="match-score">{m.score}</div><div><strong>{m.creator.name}</strong><span>{m.factors.join(' · ') || 'Explore their profile'}</span></div><ArrowUpRight size={16}/></Link>)}</div></> : <><span className="eyebrow">YOUR OPPORTUNITY</span><h2>Make work worth sharing.</h2><p>Send a specific note about your approach. The brand will see your profile alongside your application.</p></>}</aside></div>{owned && <div className="container applications-section"><div className="dash-section-head"><div><span className="eyebrow">CREATORS INTERESTED</span><h2>Applications</h2></div></div><Alert error={actionError}/>{related.length ? <div className="application-grid">{related.map(a => <div className="application-card" key={a.id}><Link to={`/creators/${a.creator_id}`}><strong>{a.creator.name}</strong> <ArrowUpRight size={16}/></Link><p>{a.note}</p><span className="eyebrow">{a.status}</span>{a.status === 'pending' && <Primary disabled={busy} onClick={() => accept(a.id)}>Accept & start project <ArrowRight size={16}/></Primary>}</div>)}</div> : <p className="muted">Applications will appear here when creators apply.</p>}</div>}</main>
}

function Opportunities() {
  const { data, loading, error } = useRequest('/briefs', [])
  return <main className="page-light"><div className="container page-head"><span className="eyebrow">OPEN BRIEFS</span><h1>Find your next<br/><em>creative challenge.</em></h1><p>Explore projects looking for a fresh point of view.</p></div><div className="container brief-list opportunities-list">{loading ? <p>Loading briefs…</p> : error ? <Alert error={error}/> : data?.length ? data.map(b => <Link className="brief-row" to={`/briefs/${b.id}`} key={b.id}><div><span className="eyebrow">{b.category} / {b.location || 'Remote friendly'}</span><h3>{b.title}</h3><p>{b.description}</p></div><div><strong>{currency(b.budget)}</strong><ArrowUpRight/></div></Link>) : <Empty title="No open briefs yet" detail="Check back for new opportunities."/>}</div></main>
}

function ProfileEdit({ refresh }) {
  const navigate = useNavigate()
  const { data, loading } = useRequest('/me', [])
  const [form, setForm] = useState(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { if (data?.creator) { const c = data.creator; setForm({ title: c.title, bio: c.bio, location: c.location, categories: c.categories.join(', '), skills: c.skills.join(', '), platforms: c.platforms.join(', '), audience: c.audience, rate: c.rate, social_links: c.social_links || {}, contact_email: c.contact_email || '' }) } }, [data])
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const setSocial = (key, value) => setForm(f => ({ ...f, social_links: { ...f.social_links, [key]: value } }))
  async function save(e) { e.preventDefault(); setBusy(true); setError(''); try { await api('/me/creator', { method: 'PUT', body: { ...form, contact_email: form.contact_email || null, categories: csv(form.categories), skills: csv(form.skills), platforms: csv(form.platforms), audience: Number(form.audience), rate: Number(form.rate) } }); refresh(); setNotice('Profile saved.'); } catch (e) { setError(e.message) } finally { setBusy(false) } }
  async function portfolio() { setBusy(true); setError(''); try { const c = await api('/me/portfolio', { method: 'POST' }); setNotice(['openai', 'gemini'].includes(c.portfolio_source) ? 'AI portfolio introduction generated.' : 'Template draft created. Add an AI key for AI generation.'); refresh(); } catch (e) { setError(e.message) } finally { setBusy(false) } }
  async function avatar(e) { const file = e.target.files?.[0]; if (!file) return; setBusy(true); setError(''); try { const body = new FormData(); body.append('file', file); await api('/me/avatar', { method: 'POST', body }); setNotice('Photo uploaded.'); refresh() } catch (e) { setError(e.message) } finally { setBusy(false) } }
  if (loading || !form) return <main className="page-light loading">Loading profile…</main>
  return <main className="page-light form-page"><div className="container narrow"><Link className="back-link" to="/dashboard">← Dashboard</Link><span className="eyebrow">YOUR CREATIVE IDENTITY</span><h1>Shape your story<span className="accent">.</span></h1><p>Give brands a clear sense of your work and what you bring.</p><form className="editor-form" onSubmit={save}><label>Your title<input required value={form.title} onChange={e => set('title', e.target.value)} placeholder="Filmmaker & storyteller"/></label><label>About you<textarea required rows={5} value={form.bio} onChange={e => set('bio', e.target.value)} placeholder="What do you create and why?"/></label><label>Location<input value={form.location} onChange={e => set('location', e.target.value)} placeholder="City, Country"/></label><div className="form-two"><label>Categories<input value={form.categories} onChange={e => set('categories', e.target.value)} placeholder="Fashion, Lifestyle"/></label><label>Skills<input value={form.skills} onChange={e => set('skills', e.target.value)} placeholder="Video, Editing"/></label></div><label>Platforms<input value={form.platforms} onChange={e => set('platforms', e.target.value)} placeholder="Instagram, TikTok"/></label><label>Public contact email (optional)<input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="hello@yourstudio.com"/><small>Only add an address you want brands to see. It enables the Email creator button on your public profile.</small></label><div className="social-fields"><span className="eyebrow">YOUR CHANNELS</span><p>Add your profile URLs so brands can visit your work. Only the logos appear on your public profile.</p><div className="social-field-grid">{socialPlatforms.map(({ key, label, Icon }) => <label key={key}><span><Icon aria-hidden="true"/> {label}</span><input type="url" inputMode="url" value={form.social_links?.[key] || ''} onChange={e => setSocial(key, e.target.value)} placeholder={`https://${key === 'x' ? 'x.com/yourname' : key + '.com/yourname'}`}/></label>)}</div></div><div className="form-two"><label>Audience size<input type="number" min="0" value={form.audience} onChange={e => set('audience', e.target.value)}/></label><label>Starting rate (USD)<input type="number" min="0" value={form.rate} onChange={e => set('rate', e.target.value)}/></label></div><Alert error={error}/>{notice && <div className="notice">{notice}</div>}<Primary disabled={busy}>Save profile <Check size={17}/></Primary></form><div className="profile-tools"><div><span className="eyebrow">PORTFOLIO INTRO</span><h2>Find the words.</h2><p>Save your profile first, then create a draft from your details. With a Gemini or OpenAI key this uses a real AI service; otherwise it’s labeled as a template draft.</p><button className="button button-dark" onClick={portfolio} disabled={busy}><WandSparkles size={17}/> Create introduction</button></div><div><span className="eyebrow">PROFILE PHOTO</span><h2>Show your face.</h2><p>Photo upload uses Supabase Storage when connected.</p><label className="button button-outline-dark file-button">Upload photo <input type="file" accept="image/jpeg,image/png,image/webp" onChange={avatar} disabled={busy}/></label></div></div><VerificationRequestPanel/></div></main>
}

function Project({ session }) {
  const { id } = useParams()
  const { data: projects, loading } = useRequest('/projects', [])
  const [messages, setMessages] = useState([]), [body, setBody] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [completed, setCompleted] = useState(false)
  const project = projects?.find(p => p.id === id)
  const projectStatus = completed ? 'completed' : project?.status
  useEffect(() => { if (project) api(`/projects/${id}/messages`).then(setMessages).catch(e => setError(e.message)) }, [project?.id])
  async function send(e) { e.preventDefault(); setBusy(true); setError(''); try { const message = await api(`/projects/${id}/messages`, { method: 'POST', body: { body } }); setMessages(m => [...m, message]); setBody('') } catch (e) { setError(e.message) } finally { setBusy(false) } }
  async function complete() { setBusy(true); setError(''); try { await api(`/projects/${id}/complete`, { method: 'POST' }); setCompleted(true) } catch (e) { setError(e.message) } finally { setBusy(false) } }
  if (loading) return <main className="page-light loading">Loading project…</main>
  if (!project) return <main className="page-light loading"><Alert error="Project not found"/></main>
  return <main className="page-light project-page"><div className="container"><Link className="back-link" to="/dashboard">← Dashboard</Link><span className="eyebrow">COLLABORATION SPACE / {projectStatus}</span><h1>{project.brief.title}<span className="accent">.</span></h1><p>Working with {session.user.role === 'brand' ? project.creator.name : 'the brand'}</p><div className="project-layout"><div className="conversation"><div className="conversation-head"><h2>Project conversation</h2><span>{messages.length} MESSAGES</span></div><div className="message-list">{messages.length ? messages.map(m => <div className={m.sender_id === session.user.id ? 'message mine' : 'message'} key={m.id}><span>{m.sender_id === session.user.id ? 'YOU' : 'COLLABORATOR'}</span><p>{m.body}</p><time>{new Date(m.created_at).toLocaleString()}</time></div>) : <Empty title="Start the conversation" detail="Share a thought, a question or a first next step."/>}</div><form className="message-form" onSubmit={send}><input required value={body} onChange={e => setBody(e.target.value)} placeholder="Write a message…"/><button disabled={busy} aria-label="Send message"><Send size={19}/></button></form><Alert error={error}/></div><aside className="project-aside"><span className="eyebrow">THE BRIEF</span><h3>{project.brief.title}</h3><p>{project.brief.description}</p><div className="profile-group"><span>BUDGET</span><strong>{currency(project.brief.budget)}</strong></div>{session.user.role === 'brand' && projectStatus === 'active' && <button className="button button-dark" disabled={busy} onClick={complete}>Mark project complete <Check size={16}/></button>}</aside></div><ProjectReview projectId={id} status={projectStatus} role={session.user.role}/></div></main>
}

function Footer() { return <footer className="footer"><div className="container"><div><Logo/><p>Creative energy, connected.</p></div><div><Link to="/discover">Discover</Link><Link to="/join">Join Crevo</Link><span>© {new Date().getFullYear()} Crevo</span></div></div></footer> }

export default function App() {
  const location = useLocation()
  const [session, setSession] = useState(null), [checking, setChecking] = useState(Boolean(token() || authMode() === 'firebase')), [version, setVersion] = useState(0)
  useEffect(() => { if (!token() && authMode() !== 'firebase') return; api('/me').then(data => setSession({ user: data.user, is_admin: data.is_admin })).catch(() => { setToken(null); setAuthMode(null) }).finally(() => setChecking(false)) }, [])
  async function logout() { await firebaseSignOut(); setToken(null); setAuthMode(null); setSession(null); window.location.href = '/' }
  if (checking) return <div className="boot"><BrandMark className="boot-mark"/>crevo</div>
  const authPage = location.pathname === '/login' || location.pathname === '/join'
  return <>{!authPage && <Nav session={session} onLogout={logout} dark={location.pathname !== '/'}/>}<AnimatePresence mode="wait"><Routes><Route path="/" element={<Landing/>}/><Route path="/categories" element={<CategoriesPage/>}/><Route path="/discover" element={<Discover/>}/><Route path="/creators/:id" element={<CreatorProfile session={session}/>}/><Route path="/join" element={<Auth mode="join" onAuth={setSession}/>}/><Route path="/login" element={<Auth mode="login" onAuth={setSession}/>}/><Route path="/inbox" element={<Protected session={session}><Inbox session={session}/></Protected>}/><Route path="/inbox/:threadId" element={<Protected session={session}><Inbox session={session}/></Protected>}/><Route path="/admin/verifications" element={<Protected session={session}><AdminVerifications/></Protected>}/><Route path="/dashboard" element={<Protected session={session}><Dashboard session={session} refresh={() => setVersion(x => x + 1)} key={version}/></Protected>}/><Route path="/briefs/new" element={<Protected session={session}>{session?.user?.role === 'brand' ? <BriefForm/> : <Navigate to="/dashboard"/>}</Protected>}/><Route path="/briefs/:id" element={<Protected session={session}><BriefDetail session={session}/></Protected>}/><Route path="/opportunities" element={<Protected session={session}>{session?.user?.role === 'creator' ? <Opportunities/> : <Navigate to="/dashboard"/>}</Protected>}/><Route path="/brand/profile" element={<Protected session={session}>{session?.user?.role === 'brand' ? <BrandProfile onUpdated={user => setSession(current => ({ ...current, user }))}/> : <Navigate to="/dashboard"/>}</Protected>}/><Route path="/profile/edit" element={<Protected session={session}>{session?.user?.role === 'creator' ? <ProfileEdit refresh={() => setVersion(x => x + 1)}/> : <Navigate to="/dashboard"/>}</Protected>}/><Route path="/projects/:id" element={<Protected session={session}><Project session={session}/></Protected>}/><Route path="*" element={<Navigate to="/"/>}/></Routes></AnimatePresence>{!authPage && <Footer/>}</>
}
