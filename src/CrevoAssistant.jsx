import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUp, Minus, Sparkles } from 'lucide-react'
import { CrevoMascotAsync } from './crevo-mascot/async'
import './crevo-assistant-companion.css'
import { api } from './api.js'

const suggestions = ['Help me write a brief', 'Which format should I choose?', 'How do I find a creator?']

export default function CrevoAssistant({ signedIn = false }) {
  const [open, setOpen] = useState(false)
  const [scrolling, setScrolling] = useState(false)
  useEffect(() => {
    let timer
    const pause = () => { setScrolling(true); clearTimeout(timer); timer = setTimeout(() => setScrolling(false), 180) }
    window.addEventListener('scroll', pause, { passive: true })
    return () => { window.removeEventListener('scroll', pause); clearTimeout(timer) }
  }, [])
  useEffect(() => {
    document.body.classList.toggle('crevo-chat-open', open)
    return () => document.body.classList.remove('crevo-chat-open')
  }, [open])
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const messagesRef = useRef(null)
  const inputRef = useRef(null)
  const mascotRef = useRef(null)
  const launcherRef = useRef(null)
  const [play, setPlay] = useState(false)
  const [mood, setMood] = useState('greeting')
  const [playKey, setPlayKey] = useState(0)
  const [hat, setHat] = useState(true)
  const [reaction, setReaction] = useState('Say hello to Crevo!')

  function close() {
    setOpen(false)
    requestAnimationFrame(() => launcherRef.current?.focus({ preventScroll: true }))
  }

  useEffect(() => {
    if (!open) return
    function escape(event) { if (event.key === 'Escape') close() }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [open])

  function react(action, caption) {
    mascotRef.current?.trigger(action)
    setReaction(caption)
  }

  useEffect(() => {
    if (open && !play) inputRef.current?.focus({ preventScroll: true })
  }, [open, play])
  useEffect(() => {
    const panel = messagesRef.current
    if (open && !play && panel) panel.scrollTop = panel.scrollHeight
  }, [open, play, messages, busy])

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

  return createPortal(<div className="crevo-assistant">
    {open && <button className="crevo-chat-backdrop" aria-label="Close Crevo chat" onClick={close}/>}
    <AnimatePresence>
      {open && <motion.section className="crevo-assistant-panel" role="dialog" id="crevo-assistant-panel" aria-label="Crevo assistant" initial={{ opacity: 0, y: 20, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: .96 }} transition={{ duration: .22 }}>
        <header className="crevo-assistant-head"><span className="crevo-assistant-head-mark"><span aria-hidden="true">✦</span></span><div><strong>Ask Crevo</strong><small>AI help for your next creative move</small></div><button type="button" onClick={close} aria-label="Minimize AI chat"><Minus size={19}/></button></header>
        <div className="crevo-companion-tabs" role="group" aria-label="Assistant mode">
          <button type="button" aria-pressed={!play} onClick={() => setPlay(false)}>Chat with Crevo</button>
          <button type="button" aria-pressed={play} onClick={() => setPlay(true)}>Play with Crevo</button>
        </div>
        {play ? <div className="crevo-companion-play">
          <div className="crevo-companion-stage">
            <CrevoMascotAsync ref={mascotRef} animationState={scrolling ? 'paused' : 'playing'} hat={hat} size={220} mood={mood} playKey={playKey} interactive draggable dragReturn zoom={.8} maxDpr={1} reducedMotion="auto" label="Play with Crevo. Drag to move or press to bounce." onClick={() => setReaction('That tickles!')} />
          </div>
          <p role="status">{reaction}</p>
          <div className="crevo-companion-actions">
            <button type="button" onClick={() => { setMood('greeting'); setPlayKey(key => key + 1); setReaction('Hello, creative human!') }}>Wave</button>
            <button type="button" onClick={() => react('wiggle', 'A little creative dance!')}>Wiggle</button>
            <button type="button" onClick={() => react('celebrate', 'Your next big idea deserves a celebration!')}>Celebrate</button>
            <button type="button" aria-pressed={hat} onClick={() => setHat(value => !value)}>{hat ? 'Remove hat' : 'Wear hat'}</button>
          </div>
          <small>Drag Crevo around, or tap for a bounce.</small>
        </div> : <>
        <div ref={messagesRef} className="crevo-assistant-messages" role="log" aria-live="polite">
          <div className="crevo-assistant-welcome"><Sparkles size={20}/><strong>Ideas move faster together.</strong><p>Ask about briefs, formats, finding creators, or showcasing your work.</p></div>
          {messages.map((message, index) => <div key={index} className={`crevo-assistant-message ${message.role}`}><span>{message.role === 'assistant' ? 'CREVO AI' : 'YOU'}</span><p>{message.content}</p></div>)}
          {busy && <div className="crevo-assistant-thinking" role="status"><span/><span/><span/> Thinking…</div>}
          {error && <div className="crevo-assistant-error" role="alert">{error} <button type="button" onClick={() => { setText(messages.at(-1)?.content || ''); setMessages(current => current.slice(0, -1)); setError('') }}>Edit and resend</button></div>}
        </div>
        {!messages.length && <div className="crevo-assistant-suggestions">{suggestions.map(item => <button key={item} type="button" onClick={() => signedIn ? send(item) : setText(item)}>{item}</button>)}</div>}
        {signedIn ? <form className="crevo-assistant-compose" onSubmit={event => { event.preventDefault(); send() }}><input ref={inputRef} value={text} onChange={event => setText(event.target.value)} maxLength={1500} placeholder="Ask anything about Crevo…" aria-label="Message Crevo AI"/><button type="submit" disabled={busy || !text.trim()} aria-label="Send to Crevo AI"><ArrowUp size={19}/></button></form> : <div className="crevo-assistant-signin"><p>Sign in to chat with the Crevo AI assistant.</p><Link to="/login" onClick={close}>Sign in <ArrowUp size={15}/></Link></div>}
        </>}
        <div className="crevo-assistant-foot">AI suggestions may need your review before use.</div>
      </motion.section>}
    </AnimatePresence>
    {!open && <div className="crevo-companion-dock">
      <button ref={launcherRef} type="button" className="crevo-companion-launcher" onClick={() => { setOpen(value => !value); setPlay(false) }} aria-expanded={open} aria-controls="crevo-assistant-panel" aria-label={open ? 'Minimize Crevo assistant' : 'Open Crevo assistant'} title="Chat or play with Crevo">
        {!(open && play) && <CrevoMascotAsync hat={hat} size={100} animationState={scrolling ? 'paused' : 'playing'} mood={busy ? 'thinking' : error ? 'error' : open ? 'listening' : 'idle'} interactive={false} trackCursor={false} intensity={.35} maxDpr={1} reducedMotion="auto" />}
        <span className="crevo-companion-caption">{open ? 'Minimize' : 'Ask Crevo'}</span>
      </button>
    </div>}
  </div>, document.body)
}
