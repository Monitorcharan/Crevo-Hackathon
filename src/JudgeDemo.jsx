import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, MessageCircle, Search, Sparkles } from 'lucide-react'
import { api } from './api.js'
import { briefCategories } from './categories.js'
import { scoreCreatorForBrief } from './discovery.js'
import './judge-demo.css'

const starter = {
  title: 'Launch a new coffee spot',
  description: 'A warm, energetic launch campaign showing the space, signature drinks, and people behind it.',
  category: 'AI Filmmaking',
  skills: 'Creative Direction, Storyboarding',
  platform: 'Instagram',
  deliverable: 'Video',
  budget: '2500',
}

export default function JudgeDemo() {
  const [brief, setBrief] = useState(starter)
  const [creators, setCreators] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [inquiry, setInquiry] = useState('Hi, I like your work. Would you be interested in this launch campaign?')
  const [draftMessage, setDraftMessage] = useState('')

  useEffect(() => {
    api('/creators').then(setCreators).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])

  const matches = useMemo(() => creators.map(creator => ({ creator, ...scoreCreatorForBrief(creator, brief) }))
    .sort((a, b) => b.score - a.score || a.creator.name.localeCompare(b.creator.name)), [creators, brief])
  const chosen = matches.find(item => item.creator.id === selected)
  const set = (key, value) => setBrief(current => ({ ...current, [key]: value }))

  return <main className="page-light judge-demo"><div className="container">
    <div className="judge-heading"><div><span className="eyebrow">INTERACTIVE PRODUCT WALKTHROUGH / NO SIGN-IN</span><h1>Try the whole idea<span className="accent">.</span></h1><p>Edit a brief, inspect explainable matches, shortlist a creator, and preview an inquiry.</p></div><div className="judge-disclosure"><Sparkles size={20}/><span><strong>Public demonstration</strong> — matching here is a rules-based preview using public profile fields. Nothing is published, sent, or saved to another account.</span></div></div>
    <div className="judge-stats" aria-label="Demo progress"><div><strong>01</strong><span>Brief</span><Check size={17}/></div><div><strong>02</strong><span>{matches.length} creator matches</span><Check size={17}/></div><div><strong>03</strong><span>{chosen ? 'Creator shortlisted' : 'Choose a creator'}</span>{chosen && <Check size={17}/>}</div><div><strong>04</strong><span>{draftMessage ? 'Inquiry previewed' : 'Preview inquiry'}</span>{draftMessage && <Check size={17}/>}</div></div>
    <div className="judge-layout"><section className="judge-panel judge-brief"><span className="eyebrow">01 / YOUR CAMPAIGN</span><h2>Shape the brief</h2><p>Category, skills, platform and deliverable change the ranking immediately. The other fields shape your inquiry preview.</p><label>Project title<input value={brief.title} onChange={e => set('title', e.target.value)}/></label><label>Description<textarea rows="4" value={brief.description} onChange={e => set('description', e.target.value)}/></label><div className="judge-pair"><label>Category<select value={brief.category} onChange={e => set('category', e.target.value)}>{briefCategories.map(value => <option key={value}>{value}</option>)}</select></label><label>Platform<select value={brief.platform} onChange={e => set('platform', e.target.value)}><option>Instagram</option><option>TikTok</option><option>YouTube</option></select></label></div><div className="judge-pair"><label>Deliverable<select value={brief.deliverable} onChange={e => set('deliverable', e.target.value)}><option>Video</option><option>Motion</option><option>Photography</option><option>UGC</option></select></label><label>Budget (USD)<input type="number" min="0" value={brief.budget} onChange={e => set('budget', e.target.value)}/></label></div><label>Skills, separated by commas<input value={brief.skills} onChange={e => set('skills', e.target.value)}/></label><button className="judge-reset" type="button" onClick={() => { setBrief(starter); setSelected(null); setDraftMessage('') }}>Reset example brief</button></section>
    <section className="judge-panel judge-matches"><div className="judge-section-head"><div><span className="eyebrow">02 / EXPLAINABLE MATCHES</span><h2>See the fit</h2></div><Search size={24}/></div><p>Scores indicate overlap with the selected category (40), skills (30), platform (20), and deliverable (10). They are illustrative estimates, not AI predictions or creator endorsements.</p>{loading && <p role="status">Loading public creators…</p>}{error && <div className="alert" role="alert">Could not load creators: {error}</div>}{!loading && !error && matches.length === 0 && <p>No public creators are available yet.</p>}<div className="judge-match-list">{matches.slice(0, 8).map(({ creator, score, reasons }) => <article className={selected === creator.id ? 'judge-match selected' : 'judge-match'} key={creator.id}><div className="judge-match-top"><div><span className="eyebrow">{creator.portfolio_source === 'demo' ? 'ILLUSTRATIVE PROFILE' : 'PUBLIC PROFILE'}</span><h3>{creator.name}</h3><p>{creator.title}</p></div><strong>{score}<small>/100</small></strong></div><div className="judge-reasons">{reasons.length ? reasons.map(reason => <span key={reason}>{reason}</span>) : <span>No field overlap yet</span>}</div><div className="judge-match-actions"><Link to={`/creators/${creator.id}`}>View profile <ArrowRight size={15}/></Link><button type="button" onClick={() => { setSelected(creator.id); setDraftMessage('') }}>{selected === creator.id ? 'Shortlisted ✓' : 'Shortlist'}</button></div></article>)}</div></section></div>
    <section className="judge-panel judge-conversation"><div><span className="eyebrow">03 / INQUIRY PREVIEW</span><h2>{chosen ? `Start with ${chosen.creator.name}` : 'Choose a creator above'}</h2><p>This is a private drafting preview. It does not contact the creator. A real brand account can use Crevo’s inbox and project messages.</p></div><div className="judge-chat"><div className="judge-chat-head"><MessageCircle size={20}/><strong>{chosen?.creator.name || 'Creator inquiry'}</strong><span>DEMO ONLY</span></div>{draftMessage ? <div className="judge-chat-bubble"><span>YOUR UNSENT DRAFT</span><p>{draftMessage}</p></div> : <div className="judge-chat-empty">Your inquiry preview will appear here.</div>}<form onSubmit={e => { e.preventDefault(); if (chosen && inquiry.trim()) setDraftMessage(inquiry.trim()) }}><label htmlFor="judge-inquiry">Message draft</label><textarea id="judge-inquiry" rows="3" value={inquiry} onChange={e => setInquiry(e.target.value)} disabled={!chosen}/><button className="button button-primary" type="submit" disabled={!chosen || !inquiry.trim()}>Preview inquiry <ArrowRight size={17}/></button></form></div></section>
    <div className="judge-next"><div><span className="eyebrow">READY FOR THE REAL WORKFLOW?</span><h2>Take the idea live.</h2><p>Use a brand account to publish a brief and contact real account holders. Shared demo accounts are available on the login page.</p></div><div><Link className="button button-dark" to="/login">Try the brand demo <ArrowRight size={17}/></Link><Link className="button button-outline-dark" to="/discover">Browse creators</Link></div></div>
  </div></main>
}
