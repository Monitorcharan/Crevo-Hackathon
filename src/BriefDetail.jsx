import { BrandLogo } from './BrandMark.jsx'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Send } from 'lucide-react'
import { api } from './api.js'
import NotificationBell from './NotificationBell.jsx'

const money = value => `$${Number(value || 0).toLocaleString()}`

export default function BriefDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(null), [brief, setBrief] = useState(null), [matches, setMatches] = useState([]), [applications, setApplications] = useState([])
  const [note, setNote] = useState(''), [notice, setNotice] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => {
    let live = true
    Promise.all([api('/me'), api(`/briefs/${id}`), api('/applications')]).then(async ([me, b, apps]) => {
      if (!live) return
      setUser(me.user); setBrief(b); setApplications(apps.filter(a => a.brief_id === id))
      if (me.user.role === 'brand' && b.owner_id === me.user.id) {
        const found = await api(`/briefs/${id}/matches`)
        if (live) setMatches(found)
      }
    }).catch(e => live && setError(e.message))
    return () => { live = false }
  }, [id, navigate])
  const owned = Boolean(user && brief && user.id === brief.owner_id)
  async function apply(e) {
    e.preventDefault(); setBusy(true); setError('')
    try { const a = await api(`/briefs/${id}/apply`, { method: 'POST', body: { note } }); setApplications(rows => [...rows, a]); setNotice('Application sent. The brand can now review your profile and note.') }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function decline(applicationId) {
    setBusy(true); setError('')
    try { const updated = await api(`/applications/${applicationId}/decline`, { method: 'POST' }); setApplications(rows => rows.map(a => a.id === applicationId ? { ...a, status: updated.status } : a)) }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function closeBrief() {
    setBusy(true); setError('')
    try { const updated = await api(`/briefs/${id}/close`, { method: 'POST' }); setBrief(current => ({ ...current, ...updated })) }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function accept(applicationId) {
    setBusy(true); setError('')
    try { const project = await api(`/applications/${applicationId}/accept`, { method: 'POST' }); navigate(`/projects/${project.id}`) }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <main className="brief-view"><div className="brief-view-nav"><BrandLogo/><div className="standalone-nav-actions"><NotificationBell user={user}/><Link to="/dashboard">Dashboard <ArrowUpRight size={15}/></Link></div></div><div className="brief-view-content">{error && <div className="alert" role="alert">{error}</div>}{!brief ? <p>{error ? 'Unable to load this brief.' : 'Loading brief…'}</p> : <>{location.state?.published && <div className="brief-published-notice" role="status"><strong>Brief published.</strong> Your project is now open for creator applications.</div>}<Link className="back-link" to={owned ? '/dashboard' : '/opportunities'}>← {owned ? 'Dashboard' : 'Opportunities'}</Link>{brief.brand && <div className="brief-brand"><div className="brief-brand-logo">{brief.brand.logo_url ? <img src={brief.brand.logo_url} alt={`${brief.brand.company_name} logo`}/> : <span aria-hidden="true">{brief.brand.company_name.slice(0,2).toUpperCase()}</span>}</div><div><span className="eyebrow">BRIEF BY</span><strong>{brief.brand.company_name}</strong></div></div>}<span className="eyebrow">{brief.category} / {brief.status}</span><h1>{brief.title}<em>.</em></h1>{owned && brief.status === 'open' && <button className="button button-dark" disabled={busy} onClick={closeBrief}>Close applications</button>}<div className="brief-view-grid"><div><p className="brief-view-description">{brief.description}</p><div className="brief-view-facts"><div><strong>{money(brief.budget)}</strong><span>BUDGET</span></div><div><strong>{brief.location || 'Flexible'}</strong><span>LOCATION</span></div></div><div className="spec-list"><h2>Creative direction</h2><div><strong>CONTENT TYPE</strong><span>{brief.content_type || 'Open to creator ideas'}</span></div><div><strong>STYLE</strong><span>{brief.style || 'Open to creator ideas'}</span></div><div><strong>FORMAT</strong><span>{brief.format || 'To be discussed'}</span></div><div><strong>COMMERCIAL USE</strong><span>{brief.commercial_use || 'Discuss rights before starting'}</span></div><div><strong>SKILLS</strong><span>{brief.skills.join(', ') || 'Flexible'}</span></div><div><strong>PLATFORMS</strong><span>{brief.platforms.join(', ') || 'Flexible'}</span></div></div>{user?.role === 'creator' && <section className="apply-panel"><span className="eyebrow">MAKE YOUR CASE</span><h2>Apply to this brief</h2>{applications.length ? <div className="notice">You applied to this brief. Status: {applications[0].status}.</div> : <form onSubmit={apply}><textarea required minLength={20} rows={5} value={note} onChange={e => setNote(e.target.value)} placeholder="Tell the brand why you’re a fit and how you’d approach the work"/><button className="button button-primary" disabled={busy}>Send application <Send size={16}/></button></form>}{notice && <div className="notice">{notice}</div>}</section>}</div><aside className="brief-view-aside">{owned ? <><span className="eyebrow">EXPLAINABLE MATCHING</span><h2>Suggested creators</h2><p>Scores combine category, skills, platforms, budget and location. When AI is available, its assessment contributes 30% for the top eight candidates.</p><div className="match-list">{matches.slice(0,8).map(m => <Link className="match" key={m.creator.id} to={`/creators/${m.creator.id}`}><div className="match-score">{m.score}</div><div><strong>{m.creator.name}</strong><span>{m.ai_reason || m.factors.join(' · ') || 'Explore their profile'}</span><small>{m.method}</small></div><ArrowUpRight size={16}/></Link>)}</div></> : <><span className="eyebrow">YOUR OPPORTUNITY</span><h2>Make work worth sharing.</h2><p>Submit a specific approach. The brand sees your creator profile and portfolio with your application.</p></>}</aside></div>{owned && <section className="brief-view-apps"><span className="eyebrow">CREATORS INTERESTED</span><h2>Applications</h2>{applications.length ? <div className="application-grid">{applications.map(a => <div className="application-card" key={a.id}><Link to={`/creators/${a.creator_id}`}><strong>{a.creator.name}</strong><ArrowUpRight size={16}/></Link><p>{a.note}</p><Link className="portfolio-view-link" to={`/creators/${a.creator_id}/work`}>Review AI portfolio <ArrowUpRight size={15}/></Link><span className="eyebrow">{a.status}</span>{a.status === 'pending' && <div className="application-actions"><button className="button button-dark" disabled={busy} onClick={() => accept(a.id)}>Accept & start project <ArrowRight size={16}/></button><button className="button button-outline-dark" disabled={busy} onClick={() => decline(a.id)}>Decline</button></div>}</div>)}</div> : <p className="muted">Applications appear here when creators apply.</p>}</section>}</>}</div></main>
}
