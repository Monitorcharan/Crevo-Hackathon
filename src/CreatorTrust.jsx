import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, BadgeCheck, Check, ShieldCheck, Star } from 'lucide-react'
import { api } from './api.js'

export function VerifiedBadge({ verifiedAt }) {
  if (!verifiedAt) return null
  return <span className="crevo-verified" title={`Submitted portfolio evidence reviewed on ${new Date(verifiedAt).toLocaleDateString()}. Tool licenses and project outcomes are not guaranteed.`}><BadgeCheck size={17}/> Portfolio evidence reviewed</span>
}

export function CreatorTrustSignals({ creatorId }) {
  const [trust, setTrust] = useState(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setTrust(null); setError('')
    api(`/creators/${creatorId}/trust`).then(result => { if (active) setTrust(result) })
      .catch(cause => { if (active) setError(cause.message) })
    return () => { active = false }
  }, [creatorId, attempt])
  const review = trust?.portfolio_review, history = trust?.history, evidence = trust?.evidence
  const reviewed = review?.status === 'reviewed'
  return <article className="creator-signal signal-trust" aria-labelledby="creator-trust-title">
    <div className="trust-panel-heading"><div><span className="signal-number">05 / EVIDENCE & ACCOUNTABILITY</span><h3 id="creator-trust-title">Trust you can inspect.</h3><p>See what is documented, what Crevo has reviewed, and what brands have approved.</p></div><span className="signal-icon"><ShieldCheck size={24}/></span></div>
    {error ? <div className="trust-load-error" role="alert">Trust records could not load. <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry</button></div> : !trust ? <p role="status">Loading trust records…</p> : <>
      <div className="trust-facts">
        <div className="trust-fact"><span className={`trust-status ${reviewed ? 'reviewed' : 'pending'}`}>{reviewed ? 'Reviewed' : review.status === 'pending' ? 'Awaiting review' : 'Not reviewed'}</span><h4>Portfolio review</h4><strong>{reviewed ? 'Evidence reviewed by Crevo' : review.status === 'pending' ? 'Review request received' : 'Independent review not completed'}</strong><p>{reviewed ? `Reviewed ${new Date(review.reviewed_at).toLocaleDateString()}. Applies to the evidence submitted for review.` : review.status === 'pending' ? 'A Crevo reviewer still needs to assess the submitted work and workflow.' : 'A creator can submit work and workflow evidence from their profile editor.'}</p>{review.evidence_url && <a href={review.evidence_url} target="_blank" rel="noopener noreferrer">Open reviewed evidence <ArrowUpRight size={14}/></a>}</div>
        <div className="trust-fact"><span className="trust-status recorded">Creator documented</span><h4>Workflow evidence</h4><strong>{evidence.documented_samples} of {evidence.work_samples} samples documented</strong><p>Samples with tools, workflow notes and an output format. These details are supplied by the creator.</p><Link to={`/creators/${creatorId}/work`}>Inspect the work & process <ArrowUpRight size={14}/></Link></div>
        <div className="trust-fact"><span className={`trust-status ${history.completed_projects ? 'reviewed' : 'neutral'}`}>{history.completed_projects ? 'Recorded on Crevo' : 'New project history'}</span><h4>Approved engagements</h4><strong>{history.completed_projects} completed {history.completed_projects === 1 ? 'engagement' : 'engagements'}</strong><p>{history.completed_projects ? `${history.checked_deliveries} with a final file that passed Crevo’s technical checks. Completion requires brand approval.` : 'No engagement with confirmed terms and a brand-approved final delivery yet.'}</p></div>
        <div className="trust-fact"><span className={`trust-status ${history.review_count ? 'recorded' : 'neutral'}`}>{history.review_count ? 'Completed-project feedback' : 'No feedback yet'}</span><h4>Brand reviews</h4><strong>{history.review_count ? `${history.rating_average.toFixed(1)} / 5 · ${history.review_count} ${history.review_count === 1 ? 'review' : 'reviews'}` : 'No completed-project reviews'}</strong><p>Only feedback from the brand on a completed engagement counts here. New creators start without a rating.</p></div>
      </div>
      <div className="trust-boundaries"><ShieldCheck size={17}/><p><strong>{trust.rights.declared ? 'Usage rights are declared by the creator.' : 'Usage rights still need to be declared.'}</strong> Portfolio review does not certify every tool, copyright or license. Confirm project-specific rights in the shared agreement.</p></div>
    </>}
  </article>
}

export function MatchTrustSummary({ trust }) {
  if (!trust) return null
  const review = trust.portfolio_review, history = trust.history
  return <div className="match-trust-summary"><h4>Trust behind this match</h4><p>{review.status === 'reviewed' ? `Submitted portfolio evidence reviewed ${new Date(review.reviewed_at).toLocaleDateString()}.` : review.status === 'pending' ? 'Portfolio evidence is awaiting independent review.' : 'Portfolio evidence has not been independently reviewed.'}</p><p>{trust.evidence.documented_samples}/{trust.evidence.work_samples} samples include tools, workflow and format. These details are creator provided.</p><p>{history.completed_projects} brand-approved engagements · {history.review_count} completed-project reviews{history.review_count ? ` · ${history.rating_average.toFixed(1)}/5` : ''}.</p></div>
}

export function CreatorReviews({ creatorId, rating, count }) {
  const [reviews, setReviews] = useState([])
  useEffect(() => { api(`/creators/${creatorId}/reviews`).then(setReviews).catch(() => {}) }, [creatorId])
  const visible = reviews
  return <section className="creator-reviews container"><div className="creator-reviews-head"><div><span className="eyebrow">BRAND FEEDBACK</span><h2>Work that speaks for itself.</h2></div><div className="creator-rating">{count ? <><Star size={24} fill="currentColor"/><strong>{rating?.toFixed(1)}</strong><span>{count} review{count === 1 ? '' : 's'} from completed Crevo projects</span></> : <span>No project reviews yet</span>}</div></div>
    {visible.length ? <div className="review-list">{visible.map((review, index) => <article key={review.id || index} className="review-card"><div className="review-card-top"><strong>{review.brand_name}</strong><span>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></div><small>{review.project_title}{review.created_at ? ` · ${new Date(review.created_at).toLocaleDateString()}` : ''}</small><p>{review.body}</p></article>)}</div> : <p className="muted">Reviews appear here after brands complete projects with this creator.</p>}
  </section>
}

export function VerificationRequestPanel() {
  const [status, setStatus] = useState(null)
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [statement, setStatement] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { api('/me/verification').then(setStatus).catch(e => setError(e.message)) }, [])

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const request = await api('/me/verification', { method: 'POST', body: { evidence_url: evidenceUrl, statement } })
      setStatus(current => ({ ...current, request }))
    } catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }

  return <section className="verification-panel"><span className="eyebrow">CREVO VERIFICATION</span><h2>Show the work behind the work.</h2><p>Submit a public portfolio or workflow link for review. A Crevo administrator must approve the evidence before the badge appears. The badge means portfolio evidence was reviewed; it does not guarantee results.</p>
    {status?.verified_at ? <div className="notice" role="status"><VerifiedBadge verifiedAt={status.verified_at}/> Your submitted portfolio evidence was approved.{status.request?.status === 'approved' && status.request.decision_note && <p>Reviewer feedback: {status.request.decision_note}</p>}</div> : status?.request?.status === 'pending' ? <div className="notice" role="status">Review requested {new Date(status.request.created_at).toLocaleDateString()}. A Crevo reviewer still needs to assess the evidence. <a href={status.request.evidence_url} target="_blank" rel="noopener noreferrer">View submitted evidence ↗</a></div> : <>
      {status?.request?.status === 'rejected' && <div className="alert">Previous request was not approved.{status.request.decision_note && ` Feedback: ${status.request.decision_note}`} You can submit updated evidence.</div>}
      <form onSubmit={submit}><label>Work or workflow URL<input required type="url" pattern="https://.*" value={evidenceUrl} onChange={event => setEvidenceUrl(event.target.value)} placeholder="https://your-portfolio.com/project"/></label><label>What did you make?<textarea required minLength={30} maxLength={1500} rows={4} value={statement} onChange={event => setStatement(event.target.value)} placeholder="Explain your role, tools, process, and what you can demonstrate."/></label>{error && <div className="alert" role="alert">{error}</div>}<button className="button button-dark" disabled={busy}>{busy ? 'Submitting…' : 'Request verification'} <ArrowRight size={16}/></button></form>
    </>}
  </section>
}

export function AdminVerifications() {
  const [requests, setRequests] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [notes, setNotes] = useState({})
  const [inspected, setInspected] = useState({})
  useEffect(() => { api('/admin/verifications').then(setRequests).catch(e => setError(e.message)) }, [])
  async function decide(id, approve) {
    setBusy(id); setError('')
    try {
      await api(`/admin/verifications/${id}/decision`, { method: 'POST', body: { approve, note: notes[id] || '' } })
      setRequests(rows => rows.filter(row => row.id !== id))
    } catch (cause) { setError(cause.message) }
    finally { setBusy('') }
  }
  return <main className="page-light admin-verifications"><div className="container narrow"><Link className="back-link" to="/dashboard">← Dashboard</Link><span className="eyebrow">CREVO ADMIN</span><h1>Verification queue<span className="accent">.</span></h1><p>Review submitted work and workflow evidence. Record your assessment and its limits before making a decision.</p>{error && <div className="alert" role="alert">{error}</div>}{requests === null ? <p>Loading requests…</p> : requests.length ? requests.map(request => <article className="verification-request" key={request.id}>
    <span className="eyebrow">PENDING REVIEW · {new Date(request.created_at).toLocaleDateString()}</span><h2>{request.creator?.name || 'Creator'}</h2><p>{request.statement}</p>
    <div className="verification-links"><Link to={`/creators/${request.creator_id}`}>View Crevo profile <ArrowRight size={15}/></Link><a href={request.evidence_url} target="_blank" rel="noopener noreferrer">Open submitted evidence <ArrowRight size={15}/></a></div>
    <fieldset className="verification-checklist"><legend>Review checklist</legend>{['Opened and inspected the submitted work', 'Compared the declared tools and workflow with the evidence', 'Recorded what this review covers and any limitations'].map((label, index) => <label key={label}><input type="checkbox" checked={Boolean(inspected[request.id]?.[index])} onChange={event => setInspected(current => ({ ...current, [request.id]: { ...current[request.id], [index]: event.target.checked } }))}/>{label}</label>)}</fieldset>
    <label className="verification-decision-note">Review notes<textarea minLength={20} maxLength={500} rows={4} value={notes[request.id] || ''} onChange={event => setNotes(current => ({ ...current, [request.id]: event.target.value }))} placeholder="Describe the evidence you reviewed, your decision and any limits. The creator can see this feedback."/><small>At least 20 characters. Evidence review does not certify copyright or underlying tool licenses.</small></label>
    <div className="verification-actions"><button className="button button-primary" disabled={Boolean(busy) || (notes[request.id] || '').trim().length < 20 || ![0, 1, 2].every(index => inspected[request.id]?.[index])} onClick={() => decide(request.id, true)}><Check size={17}/> Approve evidence</button><button className="button button-outline-dark" disabled={Boolean(busy) || (notes[request.id] || '').trim().length < 20} onClick={() => decide(request.id, false)}>Request better evidence</button></div>
  </article>) : <div className="empty"><h3>Queue is clear</h3><p>New creator verification requests will appear here.</p></div>}</div></main>
}

export function ProjectReview({ projectId, status, role }) {
  const [review, setReview] = useState(null)
  const [rating, setRating] = useState(5)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { api(`/projects/${projectId}/review`).then(setReview).catch(e => setError(e.message)) }, [projectId])
  if (status !== 'completed') return null
  return <section className="project-review"><span className="eyebrow">PROJECT FEEDBACK</span><h2>{review ? 'Review from this project' : role === 'brand' ? 'Review your creator' : 'Waiting for brand feedback'}</h2>{review ? <><div className="review-stars">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</div><p>{review.body}</p></> : role === 'brand' ? <form onSubmit={async event => { event.preventDefault(); setBusy(true); setError(''); try { const result = await api(`/projects/${projectId}/review`, { method: 'POST', body: { rating, body } }); setReview(result) } catch (cause) { setError(cause.message) } finally { setBusy(false) } }}><p>Reviews are available after project completion and appear on the creator's public profile.</p><label>Rating<select value={rating} onChange={event => setRating(Number(event.target.value))}>{[5,4,3,2,1].map(value => <option key={value} value={value}>{value} star{value === 1 ? '' : 's'}</option>)}</select></label><label>Your experience<textarea required minLength={20} maxLength={1200} rows={4} value={body} onChange={event => setBody(event.target.value)} placeholder="Describe the work, communication, and outcome."/></label>{error && <div className="alert" role="alert">{error}</div>}<button className="button button-dark" disabled={busy}>{busy ? 'Posting…' : 'Post review'} <Star size={17}/></button></form> : <p>The brand can leave a review now that the project is complete.</p>}</section>
}
