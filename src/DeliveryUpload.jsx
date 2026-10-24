import { useState } from 'react'
import { api, accessToken, BASE } from './api.js'

export function DeliveryChecks({ result }) {
  if (!result) return null
  return <div className={`delivery-check-panel ${result.passed === false ? 'failed' : ''}`} role="status"><h4>{result.passed === true ? '✓ Delivery checks passed' : result.passed === false ? 'Fix these checks before submitting' : 'Manual delivery review'}</h4>{result.checks?.map(check => <p key={check.name}><strong>{check.passed ? '✓' : '×'} {check.name}</strong> — {check.detail}{!check.passed && <><br/>{check.fix}</>}</p>)}<small>{result.source}{result.metadata && <> · SHA-256 {result.metadata.sha256.slice(0, 16)}…</>}</small></div>
}

export function DeliveryLink({ delivery }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  if (!delivery.url.startsWith('/api/')) return <a className="button button-outline-dark" href={delivery.url} target="_blank" rel="noopener noreferrer">Open delivery ↗</a>
  return <><button className="button button-outline-dark" disabled={busy} onClick={async () => {
    setBusy(true); setError('')
    try {
      const bearer = await accessToken()
      const response = await fetch(`${BASE}${delivery.url.slice(4)}`, { headers: { Authorization: `Bearer ${bearer}` } })
      if (!response.ok) throw new Error('Could not download this delivery. Refresh and try again.')
      const blob = URL.createObjectURL(await response.blob()), link = document.createElement('a')
      link.href = blob; link.download = delivery.asset?.filename || 'crevo-delivery'; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(blob), 10000)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }}>{busy ? 'Downloading…' : 'Download delivery ↓'}</button>{error && <p className="workflow-error" role="alert">{error}</p>}</>
}

export default function DeliveryUpload({ projectId, onChange, onBusy }) {
  const [result, setResult] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  async function inspect(event) {
    const file = event.target.files?.[0]
    setResult(null); setError(''); onChange(null)
    if (!file) return
    if (file.size > 50 * 1024 * 1024) { setError('Choose a file under 50 MB.'); return }
    setBusy(true); onBusy(true)
    try { const body = new FormData(); body.append('file', file); const checked = await api(`/projects/${projectId}/assets`, { method: 'POST', body }); setResult(checked); onChange(checked.asset_token ? checked : null) } catch (e) { setError(e.message) } finally { setBusy(false); onBusy(false) }
  }
  return <div className="asset-upload"><label>Upload the actual delivery<input type="file" accept="image/png,image/jpeg,image/webp,video/mp4" disabled={busy} onChange={inspect}/><small>PNG, JPEG, WebP or MP4 · up to 50 MB. Crevo inspects file bytes for dimensions, type and video duration before the brand sees a submission.</small></label>{busy && <p role="status">Uploading and checking against the brief…</p>}{error && <p className="workflow-error" role="alert">{error}</p>}<DeliveryChecks result={result}/>{result?.asset_token && <small>{result.filename} is ready to submit. The saved version will include these checks.</small>}</div>
}
