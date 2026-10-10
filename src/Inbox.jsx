import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowRight, MessageCircle, Send } from 'lucide-react'
import { api } from './api.js'
import useConversationLive from './useConversationLive.js'

export default function Inbox({ session }) {
  const { threadId } = useParams()
  const location = useLocation()
  const [threads, setThreads] = useState([])
  const [thread, setThread] = useState(null)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    api('/contact/threads').then(rows => { setThreads(rows.slice().reverse()); setLoading(false) })
      .catch(cause => { setError(cause.message); setLoading(false) })
    if (threadId) api(`/contact/threads/${threadId}`).then(setThread).catch(cause => setError(cause.message))
  }, [threadId])
  const liveStatus = useConversationLive('inbox', threadId, refresh)

  useEffect(() => {
    if (!threadId) setThread(null)
    refresh()
  }, [refresh, threadId])

  async function send(event) {
    event.preventDefault()
    if (!body.trim()) return
    setBusy(true); setError('')
    try {
      const message = await api(`/contact/threads/${threadId}/messages`, { method: 'POST', body: { body } })
      setThread(current => current ? ({ ...current, messages: current.messages.some(item => item.id === message.id) ? current.messages : [...current.messages, message] }) : current)
      setBody('')
    } catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }

  return <main className="page-light inbox-page"><div className="container">
    <span className="eyebrow">CREVO CONVERSATIONS</span><h1>Your inbox<span className="accent">.</span></h1><small role="status">{liveStatus === 'live' ? '● Live updates on' : '○ Reconnecting · messages refresh automatically'}</small>
    <p className="inbox-lead">Discuss project ideas and quote requests before you begin working together.</p>
    {location.state?.sent && <div className="notice" role="status">Message sent. Your conversation is ready here.</div>}
    {error && <div className="alert" role="alert">{error}</div>}
    <div className="inbox-layout">
      <aside className="inbox-sidebar"><div className="inbox-sidebar-title">CONVERSATIONS <span>{threads.length}</span></div>
        {loading ? <p>Loading conversations…</p> : threads.length ? threads.map(item =>
          <Link key={item.id} to={`/inbox/${item.id}`} className={item.id === threadId ? 'inbox-thread active' : 'inbox-thread'}>
            <strong>{session.user.role === 'brand' ? item.creator_name : item.brand_name}</strong>
            <span>{item.kind === 'quote' ? 'QUOTE REQUEST' : 'QUESTION'} · {item.subject}</span>
            <small>{new Date(item.created_at).toLocaleDateString()}</small>
          </Link>) : <div className="inbox-empty"><MessageCircle size={28}/><h3>No conversations yet</h3><p>{session.user.role === 'brand' ? 'Open a creator profile to ask a question or request a quote.' : 'Messages from interested brands will appear here.'}</p>{session.user.role === 'brand' && <Link to="/discover">Find creators <ArrowRight size={15}/></Link>}</div>}
      </aside>
      <section className="inbox-conversation">
        {!threadId ? <div className="inbox-placeholder"><MessageCircle size={42}/><h2>Choose a conversation</h2><p>Messages and quote details stay together here.</p></div> : !thread ? <p className="inbox-loading">Loading conversation…</p> : <>
          <header className="inbox-conversation-head"><span className="eyebrow">{thread.kind === 'quote' ? 'QUOTE REQUEST' : 'DIRECT QUESTION'}</span><h2>{thread.subject}</h2><p>With {session.user.role === 'brand' ? thread.creator_name : thread.brand_name}</p></header>
          <div className="inbox-messages" role="log" aria-label="Conversation messages">
            <article className={session.user.id === thread.brand_id ? 'inbox-message mine' : 'inbox-message'}><span>{thread.brand_name} · {new Date(thread.created_at).toLocaleString()}</span><p>{thread.message}</p>{thread.kind === 'quote' && (thread.budget != null || thread.timeline) && <div className="inbox-quote-meta">{thread.budget != null && <strong>Budget: ${Number(thread.budget).toLocaleString()}</strong>}{thread.timeline && <strong>Timeline: {thread.timeline}</strong>}</div>}</article>
            {thread.messages.map(message => <article key={message.id} className={message.sender_id === session.user.id ? 'inbox-message mine' : 'inbox-message'}><span>{message.sender_id === session.user.id ? 'You' : session.user.role === 'brand' ? thread.creator_name : thread.brand_name} · {new Date(message.created_at).toLocaleString()}</span><p>{message.body}</p></article>)}
          </div>
          <form className="inbox-compose" onSubmit={send}><label htmlFor="inbox-reply">Reply</label><div><textarea id="inbox-reply" required maxLength={3000} rows={3} value={body} onChange={event => setBody(event.target.value)} placeholder="Write a reply about the project…"/><button className="button button-primary" disabled={busy || !body.trim()}>{busy ? 'Sending…' : 'Send reply'} <Send size={17}/></button></div></form>
        </>}
      </section>
    </div>
  </div></main>
}
