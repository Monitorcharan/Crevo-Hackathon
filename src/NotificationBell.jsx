import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Check, CheckCheck } from 'lucide-react'
import { api, authMode, token } from './api.js'

function readSeen(userId) {
  try { return JSON.parse(localStorage.getItem(`crevo_notifications_seen_${userId}`) || '[]') }
  catch { return [] }
}

export default function NotificationBell({ user }) {
  const [items, setItems] = useState([])
  const [seen, setSeen] = useState([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const root = useRef(null)

  useEffect(() => {
    if (!user?.id) return
    let active = true
    setSeen(readSeen(user.id))
    setItems([])
    const refresh = () => api('/notifications').then(rows => { if (active) { setItems(rows); setError('') } }).catch(cause => { if (active) setError(cause.message) })
    const whenVisible = () => { if (!document.hidden) refresh() }
    refresh()
    const timer = window.setInterval(refresh, 20000)
    document.addEventListener('visibilitychange', whenVisible)
    window.addEventListener('focus', whenVisible)
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', whenVisible); window.removeEventListener('focus', whenVisible) }
  }, [user?.id])

  useEffect(() => {
    if (!open) return
    const close = event => { if (!root.current?.contains(event.target)) setOpen(false) }
    const escape = event => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape) }
  }, [open])

  if (!user) return null
  const unread = items.filter(item => !seen.includes(item.id)).length
  function mark(ids) {
    const next = [...new Set([...seen, ...ids])].slice(-300)
    setSeen(next)
    localStorage.setItem(`crevo_notifications_seen_${user.id}`, JSON.stringify(next))
  }

  return <div className="notification-bell" ref={root}>
    <button type="button" className="notification-trigger" onClick={() => { if (!open) api('/notifications').then(setItems).catch(cause => setError(cause.message)); setOpen(value => !value) }} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} title="Notifications"><Bell size={21}/>{unread > 0 && <span className="notification-count">{unread > 99 ? '99+' : unread}</span>}</button>
    {open && <div className="notification-panel" role="region" aria-label="Notifications"><div className="notification-head"><div><span className="eyebrow">YOUR ACTIVITY</span><h2>Notifications</h2></div>{unread > 0 && <button type="button" onClick={() => mark(items.map(item => item.id))} aria-label="Mark all notifications as read"><CheckCheck size={17}/> Mark all read</button>}</div>
      <div className="notification-list">{error ? <p className="notification-empty">Couldn’t load notifications. Please try again shortly.</p> : items.length ? items.map(item => <Link className={`notification-item ${seen.includes(item.id) ? '' : 'unread'}`} key={item.id} to={item.href} onClick={() => { mark([item.id]); setOpen(false) }}><span className="notification-indicator">{seen.includes(item.id) ? <Check size={13}/> : null}</span><span className="notification-copy"><strong>{item.title}</strong><small>{item.body}</small><time>{new Date(item.created_at).toLocaleString()}</time></span></Link>) : <div className="notification-empty"><Bell size={26}/><strong>All caught up</strong><p>Messages and marketplace updates will appear here.</p></div>}</div>
      <small className="notification-foot">Read status is saved on this device.</small>
    </div>}
  </div>
}

export function NotificationBellAuto() {
  const [user, setUser] = useState(null)
  useEffect(() => {
    if (!token() && authMode() !== 'firebase') { setUser(null); return }
    let active = true
    api('/me').then(data => { if (active) setUser(data.user) }).catch(() => { if (active) setUser(null) })
    return () => { active = false }
  }, [])
  return <NotificationBell user={user}/>
}
