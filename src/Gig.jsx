import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, CirclePlus, Pencil, Trash2 } from 'lucide-react'
import { BrandLogo } from './BrandMark.jsx'
import { NotificationBellAuto } from './NotificationBell.jsx'
import { api, authMode, token } from './api.js'
import CreatorContact from './CreatorContact.jsx'
import { CreatorReviews, VerifiedBadge } from './CreatorTrust.jsx'
import { demoFeedbackFor } from './demoReviews.js'
import FormatPicker, { formatComplete, normalizeFormat } from './FormatPicker.jsx'

const blank = { title: '', description: '', media_url: '', tools: '', workflow: '', format: '', commercial_use: '' }
const split = value => value.split(',').map(item => item.trim()).filter(Boolean)

function GigShell({ children }) {
  return <div className="portfolio-page"><header className="portfolio-nav"><BrandLogo/><div className="portfolio-nav-links"><NotificationBellAuto/><Link to="/discover">Discover creators <ArrowUpRight size={16}/></Link></div></header>{children}</div>
}

export function GigCard({ gig }) {
  return <Link to={`/gigs/${gig.id}`} className="gig-card"><div className="gig-card-image"><img src={gig.cover_url} alt="" loading="lazy"/>{gig.verification === 'illustrative demo' && <span>ILLUSTRATIVE DEMO</span>}</div><div className="gig-card-copy"><small>SERVICE OFFER</small><h3>{gig.title}</h3><p>{gig.description}</p><span>Explore gig <ArrowUpRight size={16}/></span></div></Link>
}

export function GigManager() {
  const navigate = useNavigate()
  const [creator, setCreator] = useState(null)
  const [gigs, setGigs] = useState([])
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (!token() && authMode() !== 'firebase') { navigate('/login'); return }
    Promise.all([api('/me'), api('/me/gigs')]).then(([me, rows]) => {
      if (me.user.role !== 'creator') { navigate('/dashboard'); return }
      setCreator(me.creator); setGigs(rows)
    }).catch(cause => setError(cause.message))
  }, [navigate])
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))

  function edit(gig) {
    setEditing(gig.id)
    setForm({ title: gig.title, description: gig.description, media_url: gig.cover_url,
      tools: gig.tools.join(', '), workflow: gig.workflow, format: normalizeFormat(gig.format), commercial_use: gig.commercial_use })
    setError(''); setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function reset() { setEditing(''); setForm(blank); setError(''); setNotice('') }

  async function upload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true); setError('')
    try {
      const body = new FormData(); body.append('file', file)
      const result = await api('/me/gigs/cover', { method: 'POST', body })
      set('media_url', result.url)
      setNotice('Cover image uploaded. Save the gig to publish it.')
    } catch (cause) { setError(cause.message) }
    finally { setUploading(false) }
  }

  async function save(event) {
    event.preventDefault()
    if (!formatComplete(form.format)) { setError('Choose an output format and aspect ratio.'); return }
    setBusy(true); setError('')
    try {
      const payload = { ...form, tools: split(form.tools) }
      const gig = await api(editing ? `/me/gigs/${editing}` : '/me/gigs', { method: editing ? 'PUT' : 'POST', body: payload })
      setGigs(current => editing ? current.map(item => item.id === editing ? gig : item) : [...current, gig])
      setEditing(''); setForm(blank); setNotice('Gig saved. Brands can now view it on your profile.')
    } catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }

  async function remove(gig) {
    if (!window.confirm(`Remove “${gig.title}” from your public profile?`)) return
    setBusy(true); setError('')
    try {
      await api(`/me/gigs/${gig.id}`, { method: 'DELETE' })
      setGigs(current => current.filter(item => item.id !== gig.id))
      if (editing === gig.id) reset()
      setNotice('Gig removed.')
    } catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }

  return <GigShell><main className="gig-studio container"><Link className="back-link" to="/dashboard">← Dashboard</Link><span className="eyebrow">CREATOR STUDIO / SERVICES</span><h1>Offer your <em>craft.</em></h1><p className="gig-lead">Create a clear service listing so brands can understand what you offer, what you deliver, and how to start.</p>
    <div className="gig-studio-grid"><form className="gig-editor" onSubmit={save}><span className="eyebrow">{editing ? 'EDIT YOUR GIG' : 'NEW GIG'}</span><h2>{editing ? 'Refine your offer' : 'Add a gig'}</h2>
      <label>Gig title<input required minLength={8} maxLength={120} value={form.title} onChange={event => set('title', event.target.value)} placeholder="I will create AI campaign visuals for your brand"/></label>
      <label>About this gig<textarea required minLength={40} maxLength={4000} rows={8} value={form.description} onChange={event => set('description', event.target.value)} placeholder="Who is this for? What will you create? Explain your approach and what makes your work distinct."/><small>Use short paragraphs or lines to make the offer easy to scan.</small></label>
      <label>Cover image URL<input required type="url" pattern="https://.*" value={form.media_url} onChange={event => set('media_url', event.target.value)} placeholder="https://your-site.com/cover.jpg"/></label>
      <label className="gig-upload">Or upload a cover image <input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} disabled={uploading || busy}/><small>{uploading ? 'Uploading…' : 'JPG, PNG or WebP, up to 5 MB'}</small></label>
      {form.media_url && <img className="gig-cover-preview" src={form.media_url} alt="Gig cover preview"/>}
      <label>Tools and expertise<input value={form.tools} onChange={event => set('tools', event.target.value)} placeholder="Runway, Midjourney, Editing, Art direction"/><small>Separate items with commas. These are creator reported.</small></label>
      <label>What is included<textarea required minLength={15} maxLength={1500} rows={4} value={form.workflow} onChange={event => set('workflow', event.target.value)} placeholder="Discovery, moodboard, concepts, revisions, final files…"/></label>
      <FormatPicker value={form.format} onChange={value => set('format', value)} id="gig-format"/>
      <label>Commercial-use terms<textarea required minLength={10} maxLength={500} rows={3} value={form.commercial_use} onChange={event => set('commercial_use', event.target.value)} placeholder="Which uses are included? What must be agreed before production?"/></label>
      <p className="gig-rate-note">Starting rate shown to brands: <strong>{creator?.rate ? `$${Number(creator.rate).toLocaleString()}` : 'Custom quote'}</strong>. Update it in your creator profile.</p>
      {error && <div className="alert" role="alert">{error}</div>}{notice && <div className="notice" role="status">{notice}</div>}
      <div className="gig-editor-actions"><button className="button button-primary" disabled={busy || uploading}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Publish gig'} <ArrowRight size={17}/></button>{editing && <button type="button" className="button button-outline-dark" onClick={reset}>Cancel edit</button>}</div>
    </form><aside className="gig-existing"><span className="eyebrow">YOUR PUBLIC OFFERS</span><h2>{gigs.length} gig{gigs.length === 1 ? '' : 's'}</h2>{gigs.length ? gigs.map(gig => <article key={gig.id} className="gig-existing-item"><img src={gig.cover_url} alt=""/><div><strong>{gig.title}</strong><small>{gig.format}</small><div><button type="button" onClick={() => edit(gig)}><Pencil size={15}/> Edit</button><Link to={`/gigs/${gig.id}`}>View <ArrowUpRight size={15}/></Link><button type="button" onClick={() => remove(gig)} disabled={busy}><Trash2 size={15}/> Remove</button></div></div></article>) : <p>Publish your first gig to show brands the services you offer.</p>}</aside></div>
  </main></GigShell>
}

export function GigDetail() {
  const { id } = useParams()
  const [gig, setGig] = useState(null)
  const [session, setSession] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    api(`/gigs/${id}`).then(data => { if (active) setGig(data) }).catch(cause => { if (active) setError(cause.message) })
    if (token() || authMode() === 'firebase') api('/me').then(data => { if (active) setSession({ user: data.user }) }).catch(() => {})
    return () => { active = false }
  }, [id])
  if (error) return <GigShell><main className="gig-detail container"><div className="alert">{error}</div></main></GigShell>
  if (!gig) return <GigShell><main className="gig-detail container">Loading gig…</main></GigShell>
  const creator = gig.creator
  const demo = gig.verification === 'illustrative demo' || creator.portfolio_source === 'demo'
  return <GigShell><main className="gig-detail container"><Link className="back-link" to={`/creators/${creator.id}`}>← {creator.name}'s profile</Link><span className="eyebrow">{demo ? 'ILLUSTRATIVE DEMO SERVICE' : 'CREATOR SERVICE'}</span><h1>{gig.title}</h1><div className="gig-detail-grid"><div><div className="gig-hero-image"><img src={gig.cover_url} alt={`${gig.title} cover`}/>{demo && <span>ILLUSTRATIVE DEMO</span>}</div><section className="gig-about"><span className="eyebrow">THE OFFER</span><h2>About this gig</h2><p>{gig.description}</p><h3>What is included</h3><p>{gig.workflow}</p><div className="gig-specs"><div><span>TOOLS & EXPERTISE</span><strong>{gig.tools.join(', ') || 'Discuss with creator'}</strong></div><div><span>OUTPUT FORMAT</span><strong>{gig.format}</strong></div><div><span>COMMERCIAL USE</span><strong>{gig.commercial_use}</strong></div></div></section></div><aside className="gig-seller"><span className="eyebrow">GET TO KNOW THE CREATOR</span><h2>{creator.name}</h2><VerifiedBadge verifiedAt={creator.verified_at}/><p>{creator.title}</p><div className="gig-seller-facts"><div><span>FROM</span><strong>{creator.location || 'Worldwide'}</strong></div><div><span>STARTING RATE</span><strong>{creator.rate ? `$${Number(creator.rate).toLocaleString()}` : 'Custom quote'}</strong></div><div><span>CREATIVE FOCUS</span><strong>{creator.categories.join(', ') || 'AI creative work'}</strong></div></div><p className="gig-seller-bio">{creator.bio}</p>{demo && <small className="gig-demo-note">This listing and artwork are illustrative. No real client delivery or rating is claimed.</small>}<CreatorContact creator={creator} session={session}/><Link className="gig-profile-link" to={`/creators/${creator.id}`}>View creator profile <ArrowUpRight size={16}/></Link></aside></div></main><CreatorReviews creatorId={creator.id} rating={creator.rating_average} count={creator.review_count} demoReviews={demo ? demoFeedbackFor(creator) : []}/></GigShell>
}
