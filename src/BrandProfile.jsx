import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, ImagePlus } from 'lucide-react'
import { api } from './api.js'

export default function BrandProfile({ onUpdated }) {
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({ name: '', company_name: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    api('/me').then(({ user }) => {
      setProfile(user)
      setForm({ name: user.name, company_name: user.company_name || '' })
    }).catch(e => setError(e.message))
  }, [])

  async function save(event) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      const updated = await api('/me/brand', { method: 'PUT', body: form })
      setProfile(updated); onUpdated(updated)
      setNotice('Brand profile saved.')
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  async function uploadLogo(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true); setError(''); setNotice('')
    try {
      const body = new FormData()
      body.append('file', file)
      const updated = await api('/me/brand/logo', { method: 'POST', body })
      setProfile(updated); onUpdated(updated)
      setNotice('Brand logo uploaded.')
    } catch (e) { setError(e.message) }
    finally { setBusy(false); event.target.value = '' }
  }

  return <main className="page-light form-page"><div className="container narrow">
    <Link className="back-link" to="/dashboard">← Dashboard</Link>
    <span className="eyebrow">BRAND PROFILE</span>
    <h1>Make it yours<span className="accent">.</span></h1>
    <p>Show creators who they will be working with. Your company name and logo appear on your briefs.</p>
    {!profile ? <div role="status">Loading profile…</div> : <div className="brand-profile-layout">
      <div className="brand-logo-editor">
        <div className="brand-logo-preview">{profile.logo_url ? <img src={profile.logo_url} alt={`${profile.company_name || 'Brand'} logo`}/> : <span aria-hidden="true">{(profile.company_name || profile.name).slice(0, 2).toUpperCase()}</span>}</div>
        <div><span className="eyebrow">BRAND LOGO</span><h2>{profile.company_name || 'Your brand'}</h2><p>Use a square JPG, PNG, or WebP image under 5 MB.</p>
          <label className="button button-outline-dark file-button"><ImagePlus size={17}/> {busy ? 'Please wait…' : 'Upload logo'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadLogo} disabled={busy} aria-label="Upload brand logo"/></label>
        </div>
      </div>
      <form className="editor-form" onSubmit={save}>
        <label>Your name<input required minLength={2} maxLength={80} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your full name"/></label>
        <label>Brand or company name<input required minLength={2} maxLength={120} value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} placeholder="The name creators will see"/></label>
        {error && <div className="alert" role="alert">{error}</div>}
        {notice && <div className="notice" role="status">{notice}</div>}
        <button className="button button-dark" disabled={busy}>Save profile <Check size={17}/></button>
      </form>
      <Link className="under-link" to="/briefs/new">Ready to collaborate? Create a brief <ArrowRight size={16}/></Link>
    </div>}
  </div></main>
}
