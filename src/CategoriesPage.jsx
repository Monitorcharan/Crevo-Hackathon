import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowUpRight, Aperture, AudioLines, BookOpenText, Box, Brush, Camera, Clapperboard, Code2, Film, Globe2, Heart, Instagram, Layers3, Linkedin, Megaphone, Mic2, MonitorPlay, Package, Palette, Pause, PenTool, Plane, Play, ScanFace, Search, Shirt, Sparkles, Utensils, Video, WandSparkles, X, Youtube } from 'lucide-react'
import { briefCategories } from './categories.js'
import categoryPhotos from './categoryPhotos.json'
import { editorialCreators } from './editorialCreators.js'
import CrevoCompanion from './CrevoCompanion.jsx'

gsap.registerPlugin(ScrollTrigger)

const showcase = [
  { name: 'AI Filmmaking', image: categoryPhotos['AI Filmmaking'].image, label: 'CINEMATIC WORLDS' },
  { name: '3D & CGI', image: categoryPhotos['3D & CGI'].image, label: 'IMPOSSIBLE MADE REAL' },
  { name: 'Fashion', image: categoryPhotos.Fashion.image, label: 'NEW VISUAL LANGUAGE' },
]

function CategoryShowcase() {
  const root = useRef(null)
  useEffect(() => {
    const stage = root.current
    if (!stage || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const cards = gsap.utils.toArray('.category-float-card', stage)
    const media = gsap.matchMedia()
    media.add('(min-width: 721px)', () => {
      const timeline = gsap.timeline({
        scrollTrigger: { trigger: stage, start: 'top 75%', end: 'bottom 55%', scrub: 1.3 },
      })
      timeline.fromTo(cards[0], { xPercent: 36, yPercent: 18, rotation: -16 }, { xPercent: 0, yPercent: -8, rotation: -8, ease: 'none' }, 0)
        .fromTo(cards[1], { yPercent: 34, rotation: 8, scale: .88 }, { yPercent: -10, rotation: 0, scale: 1, ease: 'none' }, 0)
        .fromTo(cards[2], { xPercent: -36, yPercent: 28, rotation: 15 }, { xPercent: 0, yPercent: 5, rotation: 7, ease: 'none' }, 0)
      return () => timeline.kill()
    })
    media.add('(max-width: 720px)', () => {
      const timeline = gsap.timeline({
        scrollTrigger: { trigger: stage, start: 'top 85%', end: 'bottom 40%', scrub: 1 },
      })
      timeline.fromTo(cards, { y: 65, opacity: .65, rotation: index => [-7, 0, 7][index] },
        { y: 0, opacity: 1, rotation: 0, stagger: .08, ease: 'none' })
      return () => timeline.kill()
    })
    return () => media.revert()
  }, [])

  return <section className="category-showcase" ref={root} aria-label="Featured creative categories">
    <div className="category-showcase-backdrop" aria-hidden="true">MAKE <span>ANYTHING.</span></div>
    <div className="category-showcase-cards">{showcase.map(({ name, image, label }, index) =>
      <Link className="category-float-card" to={`/discover?category=${encodeURIComponent(name)}`} key={name}>
        <img src={image} alt="" loading="lazy"/>
        <span className="category-float-shade"/>
        <span className="category-float-index">0{index + 1} / CREATIVE CRAFT</span>
        <span className="category-float-caption"><small>{label}</small><strong>{name}</strong></span>
        <ArrowUpRight className="category-float-arrow" size={21}/>
      </Link>)}</div>
    <div className="category-showcase-hint">SCROLL TO EXPLORE <span>↓</span></div>
  </section>
}

const details = {
  Lifestyle: ['Everyday stories with feeling', Heart],
  Fashion: ['Style made impossible to ignore', Shirt],
  Beauty: ['Fresh looks and product stories', Sparkles],
  Travel: ['Places worth remembering', Plane],
  Food: ['Visuals you can almost taste', Utensils],
  Design: ['Thoughtful form and function', Palette],
  Technology: ['Ideas from what comes next', Code2],
  Culture: ['Stories that move communities', Globe2],
  'AI Filmmaking': ['Films with a point of view', Clapperboard],
  'AI Animation': ['Characters and ideas in motion', Film],
  'Motion Design': ['Movement with a purpose', MonitorPlay],
  '3D & CGI': ['Worlds built from imagination', Box],
  'Generative Art': ['New forms of visual expression', WandSparkles],
  'Product Visualization': ['Products seen in a new light', Package],
  'AI Photography': ['Editorial frames made to stand out', Camera],
  'Social Media Content': ['Ideas made for the feed', Layers3],
  UGC: ['Human stories for real audiences', Video],
  'Graphic Design': ['Visual language with impact', Brush],
  'Brand Identity': ['A distinct look and voice', Palette],
  Illustration: ['Drawn worlds and bold ideas', PenTool],
  'Music & Audio': ['Sound that sets the scene', AudioLines],
  'Voice & Dubbing': ['The right voice for the story', Mic2],
  Copywriting: ['Words with a point of view', BookOpenText],
  'Advertising Creative': ['Campaigns that make a mark', Megaphone],
  'Virtual Influencers': ['New personalities and worlds', ScanFace],
  'AR & VFX': ['Reality with a new dimension', Aperture],
}

function CategoryCard({ name, duplicate = false }) {
  const index = briefCategories.indexOf(name)
  const [detail, Icon] = details[name] || ['Find the right creative mind', Sparkles]
  return <Link to={`/discover?category=${encodeURIComponent(name)}`} className={`craft-card craft-${['film', 'motion', 'image', 'social'][index % 4]}`} aria-label={duplicate ? undefined : `Explore ${name} creators`} aria-hidden={duplicate ? 'true' : undefined} tabIndex={duplicate ? -1 : undefined}>
    {categoryPhotos[name] ? <><img className="category-photo" src={categoryPhotos[name].image} alt="" loading="lazy"/><span className="category-photo-shade"/></> : <span className="craft-art" aria-hidden="true"><Icon strokeWidth={1.2}/></span>}
    <span className="craft-card-top"><span>{String(index + 1).padStart(2, '0')} / CREATIVE CRAFT</span><ArrowUpRight size={20}/></span>
    <span className="craft-card-bottom"><strong>{name}</strong><small>{detail}</small></span>
  </Link>
}

export function CreatorInspiration({ term = '', category = 'All', limit }) {
  const people = editorialCreators.filter(person => (category === 'All' || person.category === category) && (!term || `${person.category} ${person.name} ${person.craft}`.toLowerCase().includes(term.toLowerCase()))).slice(0, limit || undefined)
  if (!people.length) return null
  const socialLinks = [
    ['website', Globe2, 'Official work'], ['instagram', Instagram, 'Instagram'],
    ['youtube', Youtube, 'YouTube'], ['linkedin', Linkedin, 'LinkedIn'],
    ['x', null, 'X'],
  ]
  return <section className="creator-inspiration" id="creator-inspiration" aria-label="Real-world creator inspiration">
    <div className="creator-inspiration-head"><div><span className="eyebrow">REAL PEOPLE / PUBLIC WORK</span><h2>Creators worth <em>knowing.</em></h2></div><p>{people.length} real-world creative {people.length === 1 ? 'reference' : 'references'} across the selected categories. These independent people have not joined Crevo; their public work and channels are linked for research, not booking.</p></div>
    <div className="creator-inspiration-grid">{people.map((person, index) => <article className="creator-inspiration-card" key={person.category}>
      <span className="creator-inspiration-number">{String(briefCategories.indexOf(person.category) + 1).padStart(2, '0')} / {person.category.toUpperCase()}</span>
      <div className="creator-inspiration-name"><span aria-hidden="true">{person.name.split(' ').map(part => part[0]).slice(0,2).join('')}</span><div><h3>{person.name}</h3><p>{person.craft}</p></div></div>
      <p className="creator-inspiration-status">PUBLIC REFERENCE · NOT A CREVO MEMBER</p>
      <div className="creator-inspiration-links">{socialLinks.filter(([key]) => person[key]).map(([key, Icon, label]) => <a href={person[key]} key={key} target="_blank" rel="noopener noreferrer" aria-label={`${label}: ${person.name}`} title={label}>{Icon ? <Icon size={18}/> : <strong>𝕏</strong>}</a>)}</div>
    </article>)}</div>
  </section>
}

function PhotoCredits() {
  const credits = [...new Map(Object.values(categoryPhotos).map(photo => [photo.image, photo])).values()]
  const licenseUrls = { by: 'https://creativecommons.org/licenses/by/2.0/', 'by-sa': 'https://creativecommons.org/licenses/by-sa/2.0/', cc0: 'https://creativecommons.org/publicdomain/zero/1.0/' }
  return <details className="category-photo-credits"><summary>Photo credits &amp; licenses</summary><p>Category images are real photographs sourced through Openverse. The images illustrate a craft; they do not depict the named inspiration creators or verify anyone's work.</p><ul>{credits.map(photo => <li key={photo.image}><a href={photo.source} target="_blank" rel="noopener noreferrer">{photo.title || 'Photograph'}</a> by {photo.creator} · <a href={licenseUrls[photo.license]} target="_blank" rel="noopener noreferrer">CC {photo.license.toUpperCase()}</a></li>)}</ul></details>
}

function CategoryMarquee() {
  const [paused, setPaused] = useState(false)
  const rows = [briefCategories.slice(0, 9), briefCategories.slice(9, 18), briefCategories.slice(18)]
  return <section className={`category-marquee ${paused ? 'is-paused' : ''}`} aria-label="All creative categories">
    <div className="category-marquee-head"><div><span className="eyebrow">THE COMPLETE CREATIVE MIX</span><h2>Find your next <em>spark.</em></h2></div><button type="button" className="category-marquee-toggle" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? <Play size={16}/> : <Pause size={16}/>} {paused ? 'Resume motion' : 'Pause motion'}</button></div>
    <div className="category-marquee-rows">{rows.map((row, rowIndex) => <div className={`category-marquee-lane category-marquee-lane-${rowIndex + 1}`} key={rowIndex}>
      <div className="category-marquee-track"><div className="category-marquee-set">{row.map(name => <CategoryCard name={name} key={name}/>)}</div><div className="category-marquee-set" aria-hidden="true">{row.map(name => <CategoryCard name={name} duplicate key={name}/>)}</div></div>
    </div>)}</div>
  </section>
}

export default function CategoriesPage() {
  const [query, setQuery] = useState('')
  const term = query.trim().toLowerCase()
  const matches = term ? briefCategories.filter(name => `${name} ${details[name]?.[0] || ''}`.toLowerCase().includes(term)) : briefCategories

  return <main className="categories-page page-light"><div className="container">
    <div className="landing-section-head categories-heading"><div><span className="eyebrow">EXPLORE BY CRAFT / {briefCategories.length} CATEGORIES</span><h1>Find the kind of<br/><em>magic you need.</em></h1></div><div className="categories-intro-side"><p>From a cinematic launch film to a scroll-stopping campaign, start with the work you want to make.</p><CrevoCompanion size={118} mood="happy"/></div></div>
    <div className="category-search-row"><label className="category-search"><Search size={21} aria-hidden="true"/><input type="search" aria-label="Search categories" placeholder="Search categories — try filmmaking, beauty, motion…" value={query} onChange={event => setQuery(event.target.value)}/>{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear category search"><X size={19}/></button>}</label><span className="category-search-count" aria-live="polite">{term ? `${matches.length} OF ${briefCategories.length} CATEGORIES` : `${briefCategories.length} CREATIVE CATEGORIES`}</span></div>
    {!term && <CategoryShowcase/>}
    {!term ? <CategoryMarquee/> : matches.length ? <div className="craft-grid category-page-grid">{matches.map(name => <CategoryCard name={name} key={name}/>)}</div> : <div className="category-no-results"><Search size={30} aria-hidden="true"/><h2>No categories found</h2><p>Try a different craft or browse all 26 categories.</p><button type="button" className="button button-dark" onClick={() => setQuery('')}>Show all categories</button></div>}
    <CreatorInspiration term={term}/>
    <PhotoCredits/>
    <div className="craft-footer"><span>Looking for something more specific? Search creators by skill, tools, and portfolio type.</span><Link to="/discover">Browse all creators <ArrowUpRight size={16}/></Link></div>
  </div></main>
}
