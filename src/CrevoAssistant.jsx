import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUp, Minus, Sparkles } from 'lucide-react'
import { BrandMark } from './BrandMark.jsx'
import { api, authMode, token } from './api.js'

const suggestions = ['Help me write a brief', 'Which format should I choose?', 'How do I find a creator?']

export default function CrevoAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef(null)
  const inputRef = useRef(null)
  const signedIn = Boolean(token() || authMode() === 'firebase')

  useEffect(() => { if (open) { inputRef.current?.focus(); endRef.current?.scrollIntoView({ block: 'end' }) } }, [open, messages, busy])

  async function send(value = text) {
    const content = value.trim()
    if (!content || busy || !signedIn) return
    const next = [...messages, { role: 'user', content }]
    setMessages(next)
    setText('')
    setBusy(true)
    setError('')
    try {
      const result = await api('/assistant/chat', { method: 'POST', body: { messages: next.slice(-10) } })
      setMessages(current => [...current, { role: 'assistant', content: result.reply }])
    } catch (cause) {
      setError(cause.message)
    } finally {
      setBusy(false)
    }
  }

  return <div className="crevo-assistant">
    <AnimatePresence>
      {open && <motion.section className="crevo-assistant-panel" role="dialog" aria-label="Crevo AI assistant" initial={{ opacity: 0, y: 20, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: .96 }} transition={{ duration: .22 }}>
        <header className="crevo-assistant-head"><span className="crevo-assistant-head-mark"><BrandMark/></span><div><strong>Ask Crevo</strong><small>AI help for your next creative move</small></div><button type="button" onClick={() => setOpen(false)} aria-label="Minimize AI chat"><Minus size={19}/></button></header>
        <div className="crevo-assistant-messages" role="log" aria-live="polite">
          <div className="crevo-assistant-welcome"><Sparkles size={20}/><strong>Ideas move faster together.</strong><p>Ask about briefs, formats, finding creators, or showcasing your work.</p></div>
          {messages.map((message, index) => <div key={index} className={`crevo-assistant-message ${message.role}`}><span>{message.role === 'assistant' ? 'CREVO AI' : 'YOU'}</span><p>{message.content}</p></div>)}
          {busy && <div className="crevo-assistant-thinking" role="status"><span/><span/><span/> Thinking…</div>}
          {error && <div className="crevo-assistant-error" role="alert">{error} <button type="button" onClick={() => { setText(messages.at(-1)?.content || ''); setMessages(current => current.slice(0, -1)); setError('') }}>Edit and resend</button></div>}
          <div ref={endRef}/>
        </div>
        {!messages.length && <div className="crevo-assistant-suggestions">{suggestions.map(item => <button key={item} type="button" onClick={() => signedIn ? send(item) : setText(item)}>{item}</button>)}</div>}
        {signedIn ? <form className="crevo-assistant-compose" onSubmit={event => { event.preventDefault(); send() }}><input ref={inputRef} value={text} onChange={event => setText(event.target.value)} maxLength={1500} placeholder="Ask anything about Crevo…" aria-label="Message Crevo AI"/><button type="submit" disabled={busy || !text.trim()} aria-label="Send to Crevo AI"><ArrowUp size={19}/></button></form> : <div className="crevo-assistant-signin"><p>Sign in to chat with the Crevo AI assistant.</p><Link to="/login" onClick={() => setOpen(false)}>Sign in <ArrowUp size={15}/></Link></div>}
        <div className="crevo-assistant-foot">AI suggestions may need your review before use.</div>
      </motion.section>}
    </AnimatePresence>
    {!open && <button type="button" className="crevo-assistant-launcher" onClick={() => setOpen(true)} aria-label="Open Crevo AI chat" title="Ask Crevo"><BrandMark/></button>}
  </div>
}
