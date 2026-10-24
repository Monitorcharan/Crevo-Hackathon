import { useEffect, useState } from 'react'
import { api } from './api.js'
import './engagement.css'

export const defaultLicense = { usage_types: ['paid_social', 'organic_social', 'web'], territory: 'Worldwide', duration_months: 12, exclusive: false }
export const usageLabels = { organic_social: 'Organic social', paid_social: 'Paid social', web: 'Website', broadcast: 'Broadcast', print: 'Print' }

export function LicenseFields({ value, onChange, disabled = false }) {
  const terms = value || defaultLicense
  const set = (key, val) => onChange({ ...terms, [key]: val })
  return <fieldset className="license-fields" disabled={disabled}><legend>Usage rights</legend><p className="license-field-note">These fields drive automatic rights comparisons. Keep them consistent with the written commercial-use terms.</p><div className="license-uses">{Object.entries(usageLabels).map(([key, name]) => <label key={key}><input type="checkbox" checked={terms.usage_types.includes(key)} onChange={e => set('usage_types', e.target.checked ? [...terms.usage_types, key] : terms.usage_types.filter(x => x !== key))}/>{name}</label>)}</div><div className="form-two"><label>Territory<input required minLength={2} maxLength={100} value={terms.territory} onChange={e => set('territory', e.target.value)} placeholder="Worldwide or India, UK"/><small>Use “Worldwide” or a comma-separated list of countries.</small></label><label>Duration (months)<input required type="number" min="0" max="1200" step="1" value={terms.duration_months} onChange={e => set('duration_months', e.target.value === '' ? '' : Number(e.target.value))}/><small>0 explicitly grants perpetual use.</small></label></div><label className="license-exclusive"><input type="checkbox" checked={terms.exclusive} onChange={e => set('exclusive', e.target.checked)}/>Exclusive use</label></fieldset>
}

export function LicenseSummary({ terms, title = 'Declared usage rights' }) {
  return <div className="license-summary"><strong>{title}</strong>{terms ? <><p>{terms.usage_types.map(x => usageLabels[x] || x).join(' · ')}</p><span>{terms.territory} · {Number(terms.duration_months) === 0 ? 'Perpetual' : `${terms.duration_months} months`} · {terms.exclusive ? 'Exclusive' : 'Non-exclusive'}</span></> : <p>Structured rights have not been declared. Confirm them before production.</p>}</div>
}

export function LicenseCheck({ check }) {
  if (!check) return null
  return <div className={`license-check ${check.status}`}><strong>{check.status === 'compatible' ? '✓ Rights fit this brief' : check.status === 'mismatch' ? 'Usage rights conflict' : 'Rights need confirmation'}</strong>{check.issues?.length > 0 && <ul>{check.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}</div>
}

export function ProfileLicensePanel() {
  const [terms, setTerms] = useState(defaultLicense), [status, setStatus] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { api('/me').then(me => { if (me.creator?.licensing) setTerms(me.creator.licensing) }).catch(e => setError(e.message)) }, [])
  return <section className="profile-license-panel"><span className="eyebrow">COMMERCIAL READINESS</span><h2>The rights you can offer.</h2><p>Declare the uses you can provide for new work. This helps brands check fit; each project retains its own agreed terms. Only offer rights you have permission to grant.</p><form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); setStatus(''); try { await api('/me/licensing', { method: 'PUT', body: terms }); setStatus('Usage rights saved. New matches will use these terms.') } catch (e) { setError(e.message) } finally { setBusy(false) } }}><LicenseFields value={terms} onChange={setTerms}/>{error && <p className="alert" role="alert">{error}</p>}{status && <p className="notice" role="status">{status}</p>}<button className="button button-dark" disabled={busy || !terms.usage_types.length}>{busy ? 'Saving…' : 'Save offered rights'}</button></form></section>
}
