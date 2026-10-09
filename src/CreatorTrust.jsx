import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Check, Star } from 'lucide-react'
import { api } from './api.js'

export function VerifiedBadge({ verifiedAt }) {
  if (!verifiedAt) return null
  return <span className="crevo-verified" title="Crevo reviewed portfolio evidence submitted by this creator. This does not guarantee project outcomes."><BadgeCheck size={17}/> Crevo Verified</span>
}

export function CreatorReviews({ creatorId, rating, count }) {
  const [reviews, setReviews] = useState([])
  useEffect(() => { api(`/creators/${creatorId}/reviews`).then(setReviews).catch(() => {}) }, [creatorId])
  return <section className="creator-reviews container"><div className="creator-reviews-head"><div><span className="eyebrow">BRAND FEEDBACK</span><h2>Work that speaks for itself.</h2></div><div className="creator-rating">{count ? <><Star size={24} fill="currentColor"/><strong>{rating?.toFixed(1)}</strong><span>{count} review{count === 1 ? '' : 's'} from completed Crevo projects</span></> : <span>No project reviews yet</span>}</div></div>
    {reviews.length ? <div className="review-list">{reviews.map(review => <article key={review.id} className="review-card"><div className="review-card-top"><strong>{review.brand_name}</strong><span>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></div><small>{review.project_title} · {new Date(review.created_at).toLocaleDateString()}</small><p>{review.body}</p></article>)}</div> : <p className="muted">Reviews appear here after brands complete projects with this creator.</p>}
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
    {status?.verified_at ? <div className="notice" role="status"><VerifiedBadge verifiedAt={status.verified_at}/> Your portfolio evidence was approved.</div> : status?.request?.status === 'pending' ? <div className="notice" role="status">Verification request received. It is waiting for a Crevo administrator to review it.</div> : <>
      {status?.request?.status === 'rejected' && <div className="alert">Previous request was not approved.{status.request.decision_note && ` Feedback: ${status.request.decision_note}`} You can submit updated evidence.</div>}
      <form onSubmit={submit}><label>Work or workflow URL<input required type="url" pattern="https://.*" value={evidenceUrl} onChange={event => setEvidenceUrl(event.target.value)} placeholder="https://your-portfolio.com/project"/></label><label>What did you make?<textarea required minLength={30} maxLength={1500} rows={4} value={statement} onChange={event => setStatement(event.target.value)} placeholder="Explain your role, tools, process, and what you can demonstrate."/></label>{error && <div className="alert" role="alert">{error}</div>}<button className="button button-dark" disabled={busy}>{busy ? 'Submitting…' : 'Request verification'} <ArrowRight size={16}/></button></form>
    </>}
  </section>
}

export function AdminVerifications() {
  const [requests, setRequests] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  useEffect(() => { api('/admin/verifications').then(setRequests).catch(e => setError(e.message)) }, [])
  async function decide(id, approve) {
    setBusy(id); setError('')
    try {
      await api(`/admin/verifications/${id}/decision`, { method: 'POST', body: { approve, note: '' } })
      setRequests(rows => rows.filter(row => row.id !== id))
    } catch (cause) { setError(cause.message) }
    finally { setBusy('') }
  }
  return <main className="page-light admin-verifications"><div className="container narrow"><Link className="back-link" to="/dashboard">← Dashboard</Link><span className="eyebrow">CREVO ADMIN</span><h1>Verification queue<span className="accent">.</span></h1><p>Review the creator's portfolio and supporting evidence before making a decision. Only approved creators receive the badge.</p>{error && <div className="alert" role="alert">{error}</div>}{requests === null ? <p>Loading requests…</p> : requests.length ? requests.map(request => <article className="verification-request" key={request.id}><span className="eyebrow">PENDING REVIEW</span><h2>{request.creator?.name || 'Creator'}</h2><p>{request.statement}</p><div className="verification-links"><Link to={`/creators/${request.creator_id}`}>View Crevo profile <ArrowRight size={15}/></Link><a href={request.evidence_url} target="_blank" rel="noopener noreferrer">Open submitted evidence <ArrowRight size={15}/></a></div><div className="verification-actions"><button className="button button-primary" disabled={Boolean(busy)} onClick={() => decide(request.id, true)}><Check size={17}/> Approve</button><button className="button button-outline-dark" disabled={Boolean(busy)} onClick={() => decide(request.id, false)}>Reject</button></div></article>) : <div className="empty"><h3>Queue is clear</h3><p>New creator verification requests will appear here.</p></div>}</div></main>
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
