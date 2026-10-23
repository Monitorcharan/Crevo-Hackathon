import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from './api.js'
import { ProjectReview } from './CreatorTrust.jsx'
import useConversationLive from './useConversationLive.js'
import './project-workspace.css'

const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format((value || 0) / 100)
const date = value => new Date(value).toLocaleString()
const label = value => (value || '').replaceAll('_', ' ')

function Checkout({ amount, busy, error, onFinish, onClose }) {
  const [method, setMethod] = useState('UPI')
  const dialog = useRef(null)
  useEffect(() => { dialog.current.showModal() }, [])
  return <dialog ref={dialog} className="crevo-checkout" onCancel={e => { e.preventDefault(); if (!busy) onClose() }}>
    <div className="checkout-top"><span>CREVO / PAYMENTS</span><button autoFocus disabled={busy} onClick={onClose} aria-label="Close checkout">×</button></div>
    <span className="workflow-tag">SIMULATION · NO MONEY MOVES</span><h2>Sample checkout</h2><p>A Razorpay-style demo. This is not a Razorpay transaction.</p><strong className="checkout-amount">{money(amount)}</strong>
    {error && <div role="alert" className="workflow-error">{error}</div>}
    <fieldset disabled={busy}><legend>Choose a demo payment method</legend><div className="checkout-methods">{['UPI', 'Card', 'Netbanking'].map(item => <button type="button" key={item} aria-pressed={method === item} onClick={() => setMethod(item)}>{item}</button>)}</div></fieldset>
    <div className="checkout-placeholder">{method === 'UPI' ? 'Demo UPI payment' : method === 'Card' ? 'Demo card payment' : 'Demo bank payment'}<small>No account details, card numbers or OTP needed.</small></div>
    <button className="button button-lime" disabled={busy} onClick={() => onFinish('success', method)}>Simulate successful payment</button><div className="checkout-options"><button disabled={busy} onClick={() => onFinish('failed', method)}>Simulate failure</button><button disabled={busy} onClick={() => onFinish('cancelled', method)}>Simulate cancellation</button></div>
  </dialog>
}

export default function ProjectWorkspace({ session }) {
  const { id } = useParams()
  const [project, setProject] = useState(null), [messages, setMessages] = useState([])
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [checkout, setCheckout] = useState(false)
  const [amount, setAmount] = useState(''), [scope, setScope] = useState(''), [body, setBody] = useState('')
  const [title, setTitle] = useState(''), [url, setUrl] = useState(''), [notes, setNotes] = useState(''), [feedback, setFeedback] = useState('')
  const refresh = useCallback(async () => {
    const [p, m] = await Promise.all([api(`/projects/${id}/workspace`), api(`/projects/${id}/messages`)])
    setProject(current => current?.id === p.id && (current.workflow_revision || 0) > (p.workflow_revision || 0) ? current : p); setMessages(m)
  }, [id])
  useEffect(() => { setProject(null); refresh().catch(e => setError(e.message)) }, [refresh])
  useConversationLive('project', id, () => refresh().catch(() => {}), Boolean(project))
  async function action(action, extra = {}) {
    setBusy(true); setError('')
    try { const p = await api(`/projects/${id}/workflow`, { method: 'POST', body: { action, revision: project.workflow_revision || 0, ...extra } }); setProject(current => ({ ...current, ...p })); return true }
    catch (e) { setError(e.message); await refresh().catch(() => {}); return false }
    finally { setBusy(false) }
  }
  async function send(e) {
    e.preventDefault(); setBusy(true); setError('')
    try { await api(`/projects/${id}/messages`, { method: 'POST', body: { body } }); setBody(''); await refresh() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  if (!project) return <main className="page-light loading">{error || 'Opening your project…'}</main>
  const brand = session.user.role === 'brand', state = project.workflow || {}, terms = state.terms
  const deliveries = state.deliveries || [], latest = deliveries.at(-1), payment = state.payment
  const complete = project.status === 'completed', paid = payment?.status === 'demo_succeeded'
  return <main className="page-light project-page"><div className="container">
    <Link className="back-link" to="/dashboard">← Dashboard</Link><span className="eyebrow">YOUR SHARED WORKSPACE</span><h1>{project.brief?.title}</h1><p>Working with {brand ? project.creator?.name : 'the brand'} · {complete ? 'Completed' : 'In progress'}</p>
    <div className="workflow-progress">{[['01', 'Agree the scope', terms?.accepted_at], ['02', 'Create & deliver', latest], ['03', 'Review & approve', complete]].map(([n, text, done]) => <div key={n} className={done ? 'done' : ''}><span>{done ? '✓' : n}</span>{text}</div>)}</div>
    {error && <div role="alert" className="workflow-error">{error}</div>}
    <div className="workspace-grid"><section className="workspace-main">
      <article className="workflow-card"><span className="eyebrow">FROM FIRST CUT TO FINAL</span><h2>Deliveries & feedback</h2><p>{complete ? 'The project is complete. Delivery history stays here for both of you.' : 'Share a viewable delivery link, review each version, and keep feedback in one place.'}</p>
        {!deliveries.length && <div className="workflow-empty">No delivery yet. The creator’s first version will appear here.</div>}
        {[...deliveries].reverse().map(d => <div className="delivery-version" key={d.version}><div className="delivery-heading"><span className="workflow-tag">VERSION {d.version}</span><span>{label(d.status)}</span></div><h3>{d.title}</h3><p className="preserve-lines">{d.notes}</p><a className="button button-outline-dark" href={d.url} target="_blank" rel="noopener noreferrer">Open delivery ↗</a><small>Submitted {date(d.submitted_at)}</small>{d.reviewed_at && <blockquote><strong>{d.status === 'approved' ? 'Approved by brand' : 'Changes requested'}</strong><p className="preserve-lines">{d.feedback || 'Final delivery approved.'}</p><small>{date(d.reviewed_at)}</small></blockquote>}
          {brand && !complete && d === latest && d.status === 'awaiting_review' && <div className="delivery-review"><label>Feedback<textarea maxLength={5000} value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Be specific about changes, or leave an approval note."/></label><div className="workflow-actions"><button className="button button-outline-dark" disabled={busy || !feedback.trim()} onClick={() => action('revise', { version: d.version, notes: feedback })}>Request revision</button><button className="button button-dark" disabled={busy} onClick={() => action('approve', { version: d.version, notes: feedback })}>Approve & complete project</button></div><small>Approval completes this project and closes submissions.</small></div>}
        </div>)}
        {!brand && !complete && (!latest || latest.status === 'revision_requested') && <form className="workflow-form" onSubmit={async e => { e.preventDefault(); if (await action('submit', { title, url, notes })) { setTitle(''); setUrl(''); setNotes('') } }}><h3>Submit version {deliveries.length + 1}</h3><label>Delivery title<input required maxLength={160} value={title} onChange={e => setTitle(e.target.value)} placeholder="Campaign film · first cut"/></label><label>HTTPS delivery link<input required type="url" pattern="https://.*" maxLength={2000} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…"/></label><label>Production & handoff notes<textarea required maxLength={5000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Tools/models, workflow, formats, licensing and what changed…"/></label><small>Make sure your collaborator has permission to open the link.</small><button className="button button-dark" disabled={busy}>Submit for review</button></form>}
      </article>
      <article className="workflow-card"><h2>Project conversation</h2><div className="message-list">{messages.length ? messages.map(m => <div key={m.id} className={m.sender_id === session.user.id ? 'message mine' : 'message'}><span>{m.sender_id === session.user.id ? 'YOU' : 'COLLABORATOR'}</span><p>{m.body}</p><time>{date(m.created_at)}</time></div>) : <p>Discuss the brief and next steps here.</p>}</div><form className="message-form" onSubmit={send}><input required aria-label="Message" value={body} onChange={e => setBody(e.target.value)} placeholder="Write a message…"/><button disabled={busy}>Send</button></form></article>
    </section><aside className="workspace-side">
      <article className="workflow-card payment-card"><span className="workflow-tag">PAYMENT DEMO / INR</span><h2>{paid ? 'Demo payment complete' : 'Agree your project terms'}</h2><p>Explore the checkout flow. No money is charged, held or paid out.</p>
      {terms && <div className="agreed-terms"><strong className="checkout-amount">{money(terms.amount_paise)}</strong><p className="preserve-lines">{terms.scope}</p><span className="workflow-tag">{terms.accepted_at ? 'ACCEPTED BY CREATOR' : 'AWAITING CREATOR ACCEPTANCE'}</span></div>}
      {brand && !terms?.accepted_at && !complete && <form className="workflow-form" onSubmit={e => { e.preventDefault(); action('terms', { amount_paise: Math.round(Number(amount) * 100), notes: scope }) }}><label>Proposed amount (INR)<input type="number" required min="1" max="1000000" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="25000"/></label><label>Deliverables & usage terms<textarea required maxLength={5000} value={scope} onChange={e => setScope(e.target.value)} placeholder="Deliverables, deadline, revisions and commercial usage rights…"/></label><button className="button button-dark" disabled={busy}>{terms ? 'Update proposal' : 'Propose terms'}</button><small>This INR agreement is separate from the original brief’s USD budget.</small></form>}
      {!brand && terms && !terms.accepted_at && !complete && <button className="button button-dark" disabled={busy} onClick={() => action('accept_terms')}>Accept these terms</button>}
      {!terms && !brand && <p>The brand can propose an INR amount and scope here.</p>}
      {brand && terms?.accepted_at && !paid && <button className="button button-lime" disabled={busy} onClick={() => setCheckout(true)}>Try sample checkout ↗</button>}
      {payment && <div className="demo-receipt" role="status"><strong>{label(payment.status)}</strong><p>{money(payment.amount_paise)} · {payment.method}</p><small>{payment.id}<br/>{date(payment.created_at)}<br/>Simulated receipt · not proof of payment</small></div>}
      {state.payment_attempts?.length > 1 && <details><summary>Demo attempt history ({state.payment_attempts.length})</summary>{[...state.payment_attempts].reverse().map(p => <p key={p.id}>{label(p.status)} · {p.method}<small>{date(p.created_at)}</small></p>)}</details>}
      </article><article className="workflow-card"><span className="eyebrow">THE ORIGINAL BRIEF</span><h3>{project.brief?.title}</h3><p>{project.brief?.description}</p><small>Original budget: USD {Number(project.brief?.budget || 0).toLocaleString()}</small><p>{project.brief?.commercial_use}</p><h4>Delivery expectations</h4><p>{project.brief?.deliverables || "Scope to be agreed"}</p><small>Target: {project.brief?.deadline || "To be agreed"} · Revisions: {project.brief?.revision_rounds ?? "To be agreed"}</small><Link to={`/briefs/${project.brief_id}`}>View full brief →</Link></article>
    </aside></div><ProjectReview projectId={id} status={project.status} role={session.user.role}/>
    {checkout && <Checkout amount={terms.amount_paise} busy={busy} error={error} onClose={() => setCheckout(false)} onFinish={async (outcome, method) => { if (await action('payment', { outcome, method })) setCheckout(false) }}/>} 
  </div></main>
}
