import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Aperture, AudioLines, BookOpenText, Box, Brush, Camera, Clapperboard, Code2, Film, Globe2, Heart, Layers3, Megaphone, Mic2, MonitorPlay, Package, Palette, PenTool, Plane, ScanFace, Search, Shirt, Sparkles, Utensils, Video, WandSparkles, X } from 'lucide-react'
import { briefCategories } from './categories.js'

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

export default function CategoriesPage() {
  const [query, setQuery] = useState('')
  const term = query.trim().toLowerCase()
  const matches = term ? briefCategories.filter(name => `${name} ${details[name]?.[0] || ''}`.toLowerCase().includes(term)) : briefCategories

  return <main className="categories-page page-light"><div className="container">
    <div className="landing-section-head categories-heading"><div><span className="eyebrow">EXPLORE BY CRAFT / {briefCategories.length} CATEGORIES</span><h1>Find the kind of<br/><em>magic you need.</em></h1></div><p>From a cinematic launch film to a scroll-stopping campaign, start with the work you want to make.</p></div>
    <div className="category-search-row"><label className="category-search"><Search size={21} aria-hidden="true"/><input type="search" aria-label="Search categories" placeholder="Search categories — try filmmaking, beauty, motion…" value={query} onChange={event => setQuery(event.target.value)}/>{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear category search"><X size={19}/></button>}</label><span className="category-search-count" aria-live="polite">{term ? `${matches.length} OF ${briefCategories.length} CATEGORIES` : `${briefCategories.length} CREATIVE CATEGORIES`}</span></div>
    {matches.length ? <div className="craft-grid category-page-grid">{matches.map(name => {
      const index = briefCategories.indexOf(name)
      const [detail, Icon] = details[name] || ['Find the right creative mind', Sparkles]
      return <Link key={name} to={`/discover?category=${encodeURIComponent(name)}`} className={`craft-card craft-${['film', 'motion', 'image', 'social'][index % 4]}`} aria-label={`Explore ${name} creators`}>
        <span className="craft-card-top"><span>{String(index + 1).padStart(2, '0')} / CREATIVE CRAFT</span><ArrowUpRight size={20}/></span>
        <span className="craft-art" aria-hidden="true"><Icon strokeWidth={1.2}/></span>
        <span className="craft-card-bottom"><strong>{name}</strong><small>{detail}</small></span>
      </Link>
    })}</div> : <div className="category-no-results"><Search size={30} aria-hidden="true"/><h2>No categories found</h2><p>Try a different craft or browse all 26 categories.</p><button type="button" className="button button-dark" onClick={() => setQuery('')}>Show all categories</button></div>}
    <div className="craft-footer"><span>Looking for something more specific? Search creators by skill, tools, and portfolio type.</span><Link to="/discover">Browse all creators <ArrowUpRight size={16}/></Link></div>
  </div></main>
}
