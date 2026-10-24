import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Sparkles, ListChecks, Send } from 'lucide-react'
import { api } from './api.js'
import { LicenseCheck } from './Licensing.jsx'
import { MatchTrustSummary } from './CreatorTrust.jsx'
import './engagement.css'

const label = text => text.replaceAll('_', ' ')

export default function MatchStudio({ brief, matches, autoPropose = false, loading = false }) {
  const proposedOnPublish = useRef(false)
  const [candidates, setCandidates] = useState([]), [tab, setTab] = useState('matches'), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [contact, setContact] = useState(null), [message, setMessage] = useState('')
  useEffect(() => { api(`/briefs/${brief.id}/candidates`).then(setCandidates).catch(e => setError(e.message)) }, [brief.id])
  const proposed = candidates.filter(c => c.status === 'proposed')
  const shortlist = candidates.filter(c => !['proposed', 'removed'].includes(c.status))
  const active = candidates.filter(c => c.status !== 'removed')
  async function run(operation) {
    setBusy(true); setError(''); setNotice('')
    try { await operation(); setCandidates(await api(`/briefs/${brief.id}/candidates`)); return true } catch (e) { setError(e.message); return false } finally { setBusy(false) }
  }
  useEffect(() => {
    if (loading || !autoPropose || proposedOnPublish.current) return
    proposedOnPublish.current = true
    run(async () => {
      const result = await api(`/briefs/${brief.id}/agent`, { method: 'POST' })
      setNotice(result.message); setTab('shortlist')
    })
  }, [autoPropose, brief.id, loading])
  const act = (id, action, extra = {}) => run(() => api(`/candidates/${id}`, { method: 'POST', body: { action, ...extra } }))
  const shown = tab === 'matches' ? matches : active.map(c => matches.find(m => m.creator.id === c.creator_id) || { creator: c.creator, factors: [], weaknesses: [], evidence: [], strength: 'unranked', score: null }).sort((a, b) => (b.score || 0) - (a.score || 0))
  return <section className="match-studio" id="matches"><div className="r2-section-head"><div><span className="eyebrow">FROM BRIEF TO COLLABORATOR</span><h2>Find your creative fit.</h2><p>Ranked with portfolio evidence and explicit rights checks. Open a match to see the score and gaps.</p></div><button className="button button-dark" disabled={loading || busy || brief.status !== 'open'} onClick={() => run(async () => { const result = await api(`/briefs/${brief.id}/agent`, { method: 'POST' }); setNotice(result.message); setTab('shortlist') })}><Sparkles size={17}/>{busy ? 'Working…' : 'Build auto-shortlist'}</button></div>
    {matches.some(match => match.demo_scenario) && <div className="match-caution"><strong>Interactive shared demo.</strong> This labeled campaign matches the existing shared creator account. Profiles, offered rights and test media are fictional scenario data. Use the shared creator login to respond, revise and deliver.</div>}
    <div className="match-tabs" role="group" aria-label="Creator results"><button aria-pressed={tab === 'matches'} onClick={() => setTab('matches')}>Ranked matches <span>{matches.length}</span></button><button aria-pressed={tab === 'shortlist'} onClick={() => setTab('shortlist')}>Shortlist & proposals <span>{active.length}</span></button><span>{shortlist.filter(c => c.status === 'invited').length} invited · {shortlist.filter(c => c.status === 'interested').length} interested</span></div>
    {error && <div className="alert" role="alert">{error}</div>}{notice && <div className="notice" role="status">{notice}</div>}
    {proposed.length > 0 && <div className="agent-proposal"><div><ListChecks size={24}/><strong>{proposed.length} proposed creators are ready for your review</strong><p>The assistant used this brief and registered creators’ actual profile and portfolio records. Edit individual proposals below, or decide on the whole set. Outreach requires a separate invitation.</p></div><div className="r2-actions"><button className="button button-dark" disabled={busy} onClick={() => run(() => api(`/briefs/${brief.id}/agent/decision`, { method: 'POST', body: { decision: 'accept' } }))}>Accept proposals</button><button className="button button-outline-dark" disabled={busy} onClick={() => run(() => api(`/briefs/${brief.id}/agent/decision`, { method: 'POST', body: { decision: 'reject' } }))}>Reject proposals</button></div></div>}
    {matches[0]?.conflicts?.length > 0 && <div className="match-caution" role="alert">{matches[0].conflicts.join(' ')}</div>}{matches.length > 0 && !matches.some(m => m.strength === 'strong') && <div className="match-caution">No strong match yet. Review the gaps, adjust the brief, or ask creators to complete their portfolio and usage rights. Scores below 50 are weak fits.</div>}
    {loading && <p role="status">Ranking creators against this brief…</p>}{!loading && !shown.length && <div className="r2-empty">{tab === 'matches' ? 'No suitable registered creators are available yet. Try refining the brief or publishing more portfolio evidence.' : 'Your shortlist is empty. Add a ranked creator or ask the assistant to propose suitable creators.'}</div>}
    <div className="r2-match-grid">{shown.map((m, index) => {
      const c = candidates.find(c => c.creator_id === m.creator.id && c.status !== 'removed')
      return <article className={`r2-match-card ${c ? 'is-shortlisted' : ''}`} key={m.creator.id}><div className="r2-match-top"><div><span className="eyebrow">{tab === 'matches' ? `RANK ${String(index + 1).padStart(2, '0')}` : c?.source === 'agent' ? 'ASSISTANT PROPOSAL' : 'YOUR SHORTLIST'} · {m.strength} fit</span><h3><Link to={`/creators/${m.creator.id}`}>{m.creator.name}<ArrowUpRight size={18}/></Link></h3><p>{m.creator.title || 'Creator profile in progress'}</p></div><div className={`r2-score ${m.strength}`}><strong>{m.score ?? '—'}</strong><small>/100</small></div></div>
        <div className="r2-fit-reasons">{m.factors.slice(0, 3).map(reason => <p key={reason}>✓ {reason}</p>)}{!m.factors.length && <p>Request more evidence to evaluate this creator.</p>}</div><LicenseCheck check={m.licensing}/>
        <details className="match-evidence"><summary>Why this match · evidence & gaps</summary>{m.ai_reason && <p><strong>AI assessment:</strong> {m.ai_reason}</p>}<small>{m.method}. Rights checks cap scores at 49 for conflicts and 74 for unconfirmed terms.</small><div className="score-breakdown">{m.breakdown?.map(s => <div key={s.signal}><span>{s.signal}</span><meter min="0" max={s.weight} value={s.points}/><small>{s.points}/{s.weight}</small></div>)}</div>{m.evidence.length > 0 && <><h4>Relevant portfolio evidence</h4>{m.evidence.map(p => <Link className="evidence-link" key={p.id} to={`/creators/${m.creator.id}/work`}>{p.title} ↗<small>{p.format} · {p.tools.join(', ')}</small></Link>)}</>}<MatchTrustSummary trust={m.trust}/><h4>What to discuss</h4><ul>{m.weaknesses.map(gap => <li key={gap}>{gap}</li>)}</ul>{!m.weaknesses.length && <p>No gaps in the declared fields. Confirm scope and underlying tool licenses together.</p>}</details>
        {c && <div className={`candidate-status ${c.status}`}>{label(c.status)} · {c.source === 'agent' ? 'Assistant suggested' : 'Brand added'}</div>}
        <div className="r2-actions">{!c && <button className="button button-outline-dark" disabled={busy || brief.status !== 'open'} onClick={() => run(() => api(`/briefs/${brief.id}/candidates`, { method: 'POST', body: { action: 'shortlist', creator_id: m.creator.id } }))}>+ Shortlist</button>}{c?.status === 'proposed' && <button className="button button-dark" disabled={busy} onClick={() => act(c.id, 'shortlist')}>Keep creator</button>}{['proposed', 'shortlisted'].includes(c?.status) && <button className="r2-text-button" disabled={busy} onClick={() => act(c.id, 'remove')}>Remove</button>}{c?.status === 'shortlisted' && <button className="button button-dark" disabled={busy || brief.status !== 'open'} onClick={() => { setContact(c.id); setMessage(`Hi ${m.creator.name}, we’d like to discuss “${brief.title}”. We’re looking for ${brief.deliverables || brief.content_type || brief.category}. Would you be interested? Please review the brief and usage requirements.`) }}><Send size={15}/>Invite creator</button>}{c?.project_id && <Link className="button button-dark" to={`/projects/${c.project_id}`}>Open workspace ↗</Link>}{c?.thread_id && <Link className="button button-outline-dark" to={`/inbox/${c.thread_id}`}>Open conversation ↗</Link>}</div>
        {contact === c?.id && <form className="invitation-compose" onSubmit={async e => { e.preventDefault(); if (await act(c.id, 'contact', { message })) { setContact(null); setNotice('Invitation sent in Crevo. The creator can accept or decline from the brief.') } }}><label>Invitation message<textarea required minLength={20} maxLength={2000} rows={4} value={message} onChange={e => setMessage(e.target.value)}/></label><div className="r2-actions"><button className="button button-dark" disabled={busy}>Send invitation</button><button className="r2-text-button" type="button" onClick={() => setContact(null)}>Cancel</button></div></form>}
        {c?.events?.length > 0 && <details className="candidate-history"><summary>Activity history</summary><ol>{c.events.map((event, i) => <li key={i}><strong>{label(event.status)}</strong><small>{new Date(event.at).toLocaleString()}</small>{event.note && <p>{event.note}</p>}</li>)}</ol></details>}
      </article>
    })}</div><details className="shortlist-audit candidate-history"><summary>Shortlist activity · including removed proposals ({candidates.length})</summary><ol>{candidates.flatMap(c => c.events.map((event, index) => <li key={`${c.id}-${index}`}><strong>{c.creator.name} · {label(event.status)}</strong><small>{c.source === 'agent' ? 'Assistant suggestion / brand review' : 'Brand action'} · {new Date(event.at).toLocaleString()}</small>{event.note && <p>{event.note}</p>}</li>))}</ol>{!candidates.length && <p>No shortlist actions yet.</p>}</details>
  </section>
}

export function CreatorInvitation({ briefId, onRespond }) {
  const [rows, setRows] = useState([]), [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => { api(`/briefs/${briefId}/candidates`).then(setRows).catch(e => setError(e.message)) }, [briefId])
  async function respond(row, action) {
    setBusy(true); setError('')
    try { const updated = await api(`/candidates/${row.id}`, { method: 'POST', body: { action } }); setRows(current => current.map(c => c.id === updated.id ? updated : c)); onRespond?.() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <>{error && <p className="alert" role="alert">{error}</p>}{rows.map(row => <section className="creator-invitation" key={row.id}><span className="eyebrow">BRAND INVITATION · {row.status}</span><h2>You’ve been invited.</h2><p>{row.events.findLast(e => e.status === 'invited')?.note}</p>{row.status === 'invited' && <div className="r2-actions"><button className="button button-dark" disabled={busy} onClick={() => respond(row, 'interested')}>Accept invitation</button><button className="button button-outline-dark" disabled={busy} onClick={() => respond(row, 'decline')}>Decline invitation</button></div>}{row.project_id && <Link className="button button-dark" to={`/projects/${row.project_id}`}>Open your project workspace ↗</Link>}{row.status === 'interested' && <p role="status">Interest confirmed. The brand can now select you and propose the project agreement.</p>}{row.thread_id && <Link to={`/inbox/${row.thread_id}`}>Discuss the scope in your conversation ↗</Link>}</section>)}</>
}
