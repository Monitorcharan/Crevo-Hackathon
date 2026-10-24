import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from './api.js'
import { isDemoCreator } from './discovery.js'
import './round-two.css'

const list = values => [...new Set((values || []).filter(Boolean))].join(', ') || 'Not provided'

export default function CreatorComparison({ creators, onClose }) {
  const dialog = useRef(null)
  const [work, setWork] = useState({})
  const [trust, setTrust] = useState({})
  const [errors, setErrors] = useState({})
  const [attempt, setAttempt] = useState(0)
  useEffect(() => { dialog.current.showModal() }, [])
  useEffect(() => {
    const controller = new AbortController()
    setErrors({}); setWork({}); setTrust({})
    creators.forEach(c => api(`/creators/${c.id}/portfolio`, { signal: controller.signal })
      .then(items => { if (!controller.signal.aborted) setWork(current => ({ ...current, [c.id]: items })) })
      .catch(e => { if (!controller.signal.aborted) setErrors(current => ({ ...current, [c.id]: e.message })) }))
    creators.forEach(c => api(`/creators/${c.id}/trust`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setTrust(current => ({ ...current, [c.id]: result })) })
      .catch(() => { if (!controller.signal.aborted) setTrust(current => ({ ...current, [c.id]: { error: true } })) }))
    return () => controller.abort()
  }, [creators, attempt])
  const rows = [
    ['Specializations', c => list(c.categories)],
    ['Skills', c => list(c.skills)],
    ['Platforms', c => list(c.platforms)],
    ['Tools / models', (c, items) => list(items.flatMap(p => p.tools || [])), true],
    ['Work formats', (c, items) => list(items.map(p => p.format)), true],
    ['Workflow evidence', (c, items) => items.filter(p => p.workflow).map(p => `${p.title}: ${p.workflow}`).join('\n\n') || 'No workflow notes provided', true],
    ['Commercial-use statements', (c, items) => items.filter(p => p.commercial_use).map(p => `${p.title}: ${p.commercial_use}`).join('\n\n') || 'No usage terms provided', true],
    ['Trust signals', c => isDemoCreator(c) ? 'Fictional demo; not available for hire' : !trust[c.id] ? 'Loading trust records…' : trust[c.id].error ? 'Trust records unavailable; open the profile to retry.' : `${trust[c.id].portfolio_review.status === 'reviewed' ? 'Submitted evidence reviewed by Crevo' : trust[c.id].portfolio_review.status === 'pending' ? 'Portfolio review pending' : 'No independent portfolio review'}. ${trust[c.id].evidence.documented_samples}/${trust[c.id].evidence.work_samples} samples documented. ${trust[c.id].history.completed_projects} approved engagements; ${trust[c.id].history.review_count} brand reviews. Tool and license claims need project-specific checks.`],
    ['Starting rate', c => isDemoCreator(c) ? 'Illustrative only' : c.rate > 0 ? `USD ${Number(c.rate).toLocaleString()}` : 'Discuss with creator'],
  ]
  return <dialog ref={dialog} className="creator-comparison" onCancel={e => { e.preventDefault(); onClose() }} aria-labelledby="comparison-title">
    <div className="comparison-heading"><div><span className="eyebrow">YOUR SHORTLIST</span><h2 id="comparison-title">Compare the evidence.</h2></div><button autoFocus type="button" className="button button-outline-dark" onClick={onClose}>Close comparison</button></div>
    <p>Compare published information, then open the work. Missing details mean “not provided”, not a negative assessment. Usage statements are not independently verified licenses.</p>
    {Object.keys(errors).length > 0 && <div role="alert">Some portfolios could not load. <button type="button" onClick={() => setAttempt(x => x + 1)}>Retry portfolios</button></div>}
    <div className="comparison-scroll" tabIndex={0} aria-label="Creator comparison table, scroll horizontally on smaller screens"><table><thead><tr><th scope="col">What matters</th>{creators.map(c => <th scope="col" key={c.id}><Link to={`/creators/${c.id}`} onClick={onClose}>{c.name}</Link><small>{isDemoCreator(c) ? 'FICTIONAL DEMO' : 'CREVO MEMBER'}</small></th>)}</tr></thead><tbody>
      {rows.map(([name, value, needsWork]) => <tr key={name}><th scope="row">{name}</th>{creators.map(c => <td key={c.id}>{needsWork && errors[c.id] ? 'Portfolio unavailable; retry above' : needsWork && !work[c.id] ? 'Loading portfolio…' : value(c, work[c.id] || [])}</td>)}</tr>)}
      <tr><th scope="row">Portfolio</th>{creators.map(c => <td key={c.id}><Link to={`/creators/${c.id}/work`} onClick={onClose}>Open work samples</Link>{work[c.id] && <small>{work[c.id].length} published items</small>}</td>)}</tr>
    </tbody></table></div>
  </dialog>
}
