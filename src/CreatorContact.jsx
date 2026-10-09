import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, FileText, Mail, MessageCircle, Send, X } from 'lucide-react'
import { api } from './api.js'

function emailDraft(creator, subject, message, budget, timeline) {
  const body = [
    `Hi ${creator.name},`, '', message.trim(), '',
    budget ? `Budget: $${budget}` : '', timeline ? `Timeline: ${timeline}` : '',
    '', 'Sent from Crevo',
  ].filter((line, index, lines) => line || (index > 0 && lines[index - 1])).join('\n')
  return `mailto:${creator.contact_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export default function CreatorContact({ creator, session }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mode, setMode] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [budget, setBudget] = useState('')
  const [timeline, setTimeline] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const canContactInCrevo = session?.user?.role === 'brand' && Boolean(creator.owner_id)

  useEffect(() => {
    if (!mode) return
    const closeOnEscape = event => { if (event.key === 'Escape') setMode('') }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [mode])

  if (!creator.owner_id && !creator.contact_email) return null

  function open(modeToOpen) {
    setMode(modeToOpen); setMenuOpen(false); setError('')
    setSubject(modeToOpen === 'quote' ? `Quote request for ${creator.name}` : `Question for ${creator.name}`)
  }

  async function send(event) {
    event.preventDefault()
    if (!canContactInCrevo) return
    setBusy(true); setError('')
    try {
      const thread = await api(`/creators/${creator.id}/contact`, {
        method: 'POST',
        body: { creator_id: creator.id, kind: mode, subject, message, budget: budget ? Number(budget) : null, timeline },
      })
      navigate(`/inbox/${thread.id}`, { state: { sent: true } })
    } catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }

  const mailHref = creator.contact_email ? emailDraft(creator, subject || `Project inquiry for ${creator.name}`, message || `I'd like to discuss a project with you.\n\nProject requirements:`, budget, timeline) : ''

  return <div className="creator-contact">
    <button type="button" className="button button-primary" aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)}><MessageCircle size={18}/> Contact creator</button>
    {menuOpen && <div className="creator-contact-menu">
      {creator.owner_id && <>
        <button type="button" onClick={() => open('quote')}><FileText size={20}/><span><strong>Get a quote</strong><small>Share scope, timing, and budget</small></span><ArrowRight size={17}/></button>
        <button type="button" onClick={() => open('question')}><MessageCircle size={20}/><span><strong>Ask a question</strong><small>Start a private Crevo chat</small></span><ArrowRight size={17}/></button>
      </>}
      {creator.contact_email && <a href={emailDraft(creator, `Project inquiry for ${creator.name}`, "I'd like to discuss a project with you.\n\nProject requirements:", '', '')}><Mail size={20}/><span><strong>Email creator</strong><small>Open a draft in your email app</small></span><ArrowRight size={17}/></a>}
    </div>}
    {mode && <div className="contact-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setMode('') }}>
      <div className="contact-dialog" role="dialog" aria-modal="true" aria-label={mode === 'quote' ? 'Request a quote' : 'Ask the creator a question'}>
        <div className="contact-dialog-head"><div><span className="eyebrow">CONTACT {creator.name.toUpperCase()}</span><h2>{mode === 'quote' ? 'Request a quote' : 'Ask a question'}</h2></div><button type="button" onClick={() => setMode('')} aria-label="Close contact form"><X size={22}/></button></div>
        <p>{mode === 'quote' ? 'Describe what you need so the creator can give you a useful response.' : 'Ask about their work, availability, or your project idea.'}</p>
        <form onSubmit={send}>
          <label>Subject<input required maxLength={140} value={subject} onChange={event => setSubject(event.target.value)}/></label>
          <label>{mode === 'quote' ? 'Project requirements' : 'Your question'}<textarea required minLength={10} maxLength={2500} rows={6} value={message} onChange={event => setMessage(event.target.value)} placeholder={mode === 'quote' ? 'What are you creating? Include deliverables, format, style, and usage rights.' : 'What would you like to know?'} /></label>
          {mode === 'quote' && <div className="form-two"><label>Budget (USD)<input type="number" min="0" value={budget} onChange={event => setBudget(event.target.value)} placeholder="Optional"/></label><label>Ideal timeline<select value={timeline} onChange={event => setTimeline(event.target.value)}><option value="">Flexible</option><option>Within a week</option><option>Within two weeks</option><option>Within a month</option><option>Custom timeline</option></select></label></div>}
          {error && <div className="alert" role="alert">{error}</div>}
          <div className="contact-actions">
            {canContactInCrevo ? <button className="button button-dark" disabled={busy}>{busy ? 'Sending…' : mode === 'quote' ? 'Send quote request' : 'Send question'} <Send size={17}/></button> : <Link className="button button-dark" to="/join?role=brand">Join as a brand <ArrowRight size={17}/></Link>}
            {creator.contact_email && <a className="button button-outline-dark" href={mailHref}><Mail size={17}/> Open email draft</a>}
          </div>
          {creator.contact_email && <small>Your email app opens with these details filled in. Email replies are outside Crevo.</small>}
        </form>
      </div>
    </div>}
  </div>
}
