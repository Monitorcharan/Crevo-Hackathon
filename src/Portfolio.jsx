import { useEffect, useState } from 'react'
import { Link, Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, CirclePlus } from 'lucide-react'
import { api, token } from './api.js'
import App from './App.jsx'
import BriefBuilder from './BriefBuilder.jsx'
import BriefDetail from './BriefDetail.jsx'

const split = value => value.split(',').map(x => x.trim()).filter(Boolean)

function PortfolioShell({ children }) {
  return <div className="portfolio-page"><header className="portfolio-nav"><Link to="/" className="logo"><span className="logo-symbol">✳</span>crevo<span className="logo-dot">.</span></Link><Link to="/discover">Discover creators <ArrowUpRight size={16}/></Link></header>{children}</div>
}

function WorkCard({ item }) {
  return <article className="work-card"><a className="work-media" href={item.media_url} target="_blank" rel="noopener noreferrer">{item.media_type === 'image' ? <img src={item.media_url} alt={item.title}/> : <div className="work-placeholder"><span>{item.media_type === 'video' ? '▶' : '↗'}</span><small>OPEN {item.media_type.toUpperCase()}</small></div>}</a><div className="work-info"><div className="work-overline">{item.format || item.media_type} · {item.verification === 'self-reported' ? 'CREATOR REPORTED' : item.verification}</div><h3>{item.title}</h3><p>{item.description}</p><div className="work-detail"><strong>TOOLS & MODELS</strong><span>{item.tools.join(', ') || 'Not specified'}</span></div><div className="work-detail"><strong>WORKFLOW</strong><span>{item.workflow || 'Not specified'}</span></div><div className="work-detail"><strong>COMMERCIAL USE</strong><span>{item.commercial_use || 'Ask creator for terms'}</span></div></div></article>
}

export function PublicPortfolio() {
  const { id } = useParams()
  const [creator, setCreator] = useState(null), [items, setItems] = useState([]), [error, setError] = useState('')
  useEffect(() => { let live = true; Promise.all([api(`/creators/${id}`), api(`/creators/${id}/portfolio`)]).then(([c, work]) => { if (live) { setCreator(c); setItems(work) } }).catch(e => live && setError(e.message)); return () => { live = false } }, [id])
  return <PortfolioShell><main className="portfolio-content"><Link className="back-link" to={`/creators/${id}`}>← Creator profile</Link>{error ? <div className="alert">{error}</div> : !creator ? <p>Loading portfolio…</p> : <><span className="eyebrow">THE WORK / {creator.name.toUpperCase()}</span><h1>Ideas made <em>real.</em></h1><p className="portfolio-lead">A closer look at {creator.name}'s work, tools and production process. Details are creator reported unless independently verified.</p>{items.length ? <div className="work-grid">{items.map(item => <WorkCard item={item} key={item.id}/>)}</div> : <div className="empty"><h3>No work added yet</h3><p>{creator.name} is still building this portfolio.</p></div>}</>}</main></PortfolioShell>
}

export function PortfolioManager() {
  const navigate = useNavigate()
  const [creator, setCreator] = useState(null), [items, setItems] = useState([]), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', media_url: '', media_type: 'image', tools: '', workflow: '', format: '', commercial_use: '' })
  useEffect(() => { if (!token()) { navigate('/login'); return } api('/me').then(data => { if (data.user.role !== 'creator') { navigate('/dashboard'); return } setCreator(data.creator); return api(`/creators/${data.creator.id}/portfolio`) }).then(work => work && setItems(work)).catch(e => setError(e.message)) }, [navigate])
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))
  async function submit(e) { e.preventDefault(); setBusy(true); setError(''); try { const item = await api('/me/portfolio/items', { method: 'POST', body: { ...form, tools: split(form.tools) } }); setItems(items => [...items, item]); setForm({ title: '', description: '', media_url: '', media_type: 'image', tools: '', workflow: '', format: '', commercial_use: '' }) } catch (e) { setError(e.message) } finally { setBusy(false) } }
  return <PortfolioShell><main className="portfolio-content"><Link className="back-link" to="/dashboard">← Dashboard</Link><span className="eyebrow">CREATOR STUDIO</span><h1>Show the <em>work.</em></h1><p className="portfolio-lead">Add work samples and explain the tools, production workflow and usage terms behind each one.</p>{creator && <Link className="portfolio-view-link" to={`/creators/${creator.id}/work`}>View public portfolio <ArrowUpRight size={16}/></Link>}<div className="portfolio-layout"><form className="portfolio-form" onSubmit={submit}><span className="eyebrow">ADD A PROJECT</span><h2>New work sample</h2><label>Title<input required minLength={3} value={form.title} onChange={e => set('title',e.target.value)} placeholder="A campaign or piece of work"/></label><label>Description<textarea value={form.description} onChange={e => set('description',e.target.value)} rows={3} placeholder="What was the creative goal?"/></label><label>Media URL<input required type="url" value={form.media_url} onChange={e => set('media_url',e.target.value)} placeholder="https://..."/></label><label>Media type<select value={form.media_type} onChange={e => set('media_type',e.target.value)}><option value="image">Image</option><option value="video">Video</option><option value="link">Link</option></select></label><label>Tools and models<input value={form.tools} onChange={e => set('tools',e.target.value)} placeholder="Runway, Midjourney, After Effects"/><small>Separate with commas. These are self reported.</small></label><label>Workflow<textarea value={form.workflow} onChange={e => set('workflow',e.target.value)} rows={3} placeholder="How did you produce and refine this work?"/></label><label>Format / aspect ratio<input value={form.format} onChange={e => set('format',e.target.value)} placeholder="9:16 vertical video"/></label><label>Commercial-use terms<input value={form.commercial_use} onChange={e => set('commercial_use',e.target.value)} placeholder="Licensed for paid social; ask about other uses"/></label>{error && <div className="alert">{error}</div>}<button className="button button-dark" disabled={busy}><CirclePlus size={17}/>{busy ? 'Adding…' : 'Add to portfolio'}</button></form><div className="portfolio-existing"><span className="eyebrow">YOUR WORK</span><h2>{items.length} projects</h2>{items.length ? items.map(item => <div className="existing-item" key={item.id}><strong>{item.title}</strong><span>{item.media_type} · {item.tools.join(', ')}</span><a href={item.media_url} target="_blank" rel="noopener noreferrer">Open sample <ArrowUpRight size={14}/></a></div>) : <p>Projects you add will appear here and on your public portfolio.</p>}<div className="portfolio-note"><strong>Proof and verification</strong><p>Work and tool claims are marked creator reported. Crevo does not claim to verify tools, licenses or ownership in this MVP.</p></div></div></div></main></PortfolioShell>
}

export default function PortfolioApp() {
  return <Routes><Route path="/portfolio/edit" element={<PortfolioManager/>}/><Route path="/creators/:id/work" element={<PublicPortfolio/>}/><Route path="/briefs/new" element={<BriefBuilder/>}/><Route path="/briefs/:id" element={<BriefDetail/>}/><Route path="/*" element={<App/>}/></Routes>
}
