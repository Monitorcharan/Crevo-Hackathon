import { Link } from 'react-router-dom'
import { ArrowUpRight, Aperture, AudioLines, BookOpenText, Box, Brush, Camera, Clapperboard, Code2, Film, Globe2, Heart, Layers3, Megaphone, Mic2, MonitorPlay, Package, Palette, PenTool, Plane, ScanFace, Shirt, Sparkles, Utensils, Video, WandSparkles } from 'lucide-react'
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
  return <main className="categories-page page-light"><div className="container">
    <div className="landing-section-head categories-heading"><div><span className="eyebrow">EXPLORE BY CRAFT / {briefCategories.length} CATEGORIES</span><h1>Find the kind of<br/><em>magic you need.</em></h1></div><p>From a cinematic launch film to a scroll-stopping campaign, start with the work you want to make.</p></div>
    <div className="craft-grid category-page-grid">{briefCategories.map((name, index) => {
      const [detail, Icon] = details[name] || ['Find the right creative mind', Sparkles]
      return <Link key={name} to={`/discover?category=${encodeURIComponent(name)}`} className={`craft-card craft-${['film', 'motion', 'image', 'social'][index % 4]}`} aria-label={`Explore ${name} creators`}>
        <span className="craft-card-top"><span>{String(index + 1).padStart(2, '0')} / CREATIVE CRAFT</span><ArrowUpRight size={20}/></span>
        <span className="craft-art" aria-hidden="true"><Icon strokeWidth={1.2}/></span>
        <span className="craft-card-bottom"><strong>{name}</strong><small>{detail}</small></span>
      </Link>
    })}</div>
    <div className="craft-footer"><span>Looking for something more specific? Search creators by skill, tools, and portfolio type.</span><Link to="/discover">Browse all creators <ArrowUpRight size={16}/></Link></div>
  </div></main>
}
