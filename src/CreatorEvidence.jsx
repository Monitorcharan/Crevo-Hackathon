import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Clapperboard, Layers3, ScanSearch, ShieldCheck, Wrench } from 'lucide-react'
import { api } from './api.js'

const join = values => [...new Set((values || []).filter(Boolean))].join(' · ') || 'Not yet provided'
const usage = { organic_social: 'Organic social', paid_social: 'Paid social', web: 'Website', broadcast: 'Broadcast', print: 'Print' }

export default function CreatorEvidence({ creator }) {
  const [state, setState] = useState({ work: [], loading: true, error: '' })
  useEffect(() => {
    let active = true
    setState({ work: [], loading: true, error: '' })
    api(`/creators/${creator.id}/portfolio`).then(work => { if (active) setState({ work, loading: false, error: '' }) })
      .catch(error => { if (active) setState({ work: [], loading: false, error: error.message }) })
    return () => { active = false }
  }, [creator.id])
  const work = state.work.filter(item => item.media_type !== 'gig')
  const terms = creator.licensing
  const tools = work.flatMap(item => item.tools || [])
  return <section className="container creator-evidence" aria-labelledby="creator-evidence-title">
    <div className="evidence-section-heading"><div><span className="eyebrow">THE DETAILS BEHIND THE MATCH</span><h2 id="creator-evidence-title">Creative fit, backed by the work.</h2></div><Link className="button button-outline-dark" to={`/creators/${creator.id}/work`}>Open portfolio <ArrowUpRight size={17}/></Link></div>
    {state.error && <div className="alert" role="alert">Portfolio evidence could not load: {state.error}</div>}
    <div className="creator-signal-grid" aria-busy={state.loading}>
      <article className="creator-signal signal-content"><span className="signal-icon"><Clapperboard size={21}/></span><span className="signal-number">01 / CREATIVE DIRECTION</span><h3>Content fit</h3><p>{join(creator.categories)}</p><dl><div><dt>Formats</dt><dd>{state.loading ? 'Loading work…' : join(work.map(item => item.format))}</dd></div><div><dt>Channels</dt><dd>{join(creator.platforms)}</dd></div></dl></article>
      <article className="creator-signal signal-tools"><span className="signal-icon"><Wrench size={21}/></span><span className="signal-number">02 / PRODUCTION CAPABILITY</span><h3>Skills & tools</h3><p>{join(creator.skills)}</p><dl><div><dt>Tools in published work</dt><dd>{state.loading ? 'Loading work…' : join(tools)}</dd></div></dl><small>Tool use is supported by creator-provided workflow notes.</small></article>
      <article className="creator-signal signal-work"><span className="signal-icon"><Layers3 size={21}/></span><span className="signal-number">03 / PUBLISHED WORK</span><h3>Portfolio evidence</h3><p>{state.loading ? 'Loading evidence…' : `${work.length} published work ${work.length === 1 ? 'sample' : 'samples'}`}</p><ul>{work.slice(0, 3).map(item => <li key={item.id}><Link to={`/creators/${creator.id}/work`}>{item.title}<ArrowUpRight size={14}/></Link><span>{item.format || item.media_type}</span></li>)}</ul>{!state.loading && !work.length && <small>Ask the creator to publish relevant work before selecting them.</small>}</article>
      <article className="creator-signal signal-rights"><span className="signal-icon"><ScanSearch size={21}/></span><span className="signal-number">04 / DECLARED USAGE RIGHTS</span><h3>Commercial-use fit</h3><p>{terms ? join(terms.usage_types.map(value => usage[value] || value)) : 'Usage rights need confirmation'}</p>{terms && <dl><div><dt>Territory</dt><dd>{terms.territory}</dd></div><div><dt>Duration</dt><dd>{terms.duration_months === 0 ? 'Perpetual' : `${terms.duration_months} months`}</dd></div><div><dt>Exclusivity</dt><dd>{terms.exclusive ? 'Available by agreement' : 'Non-exclusive'}</dd></div></dl>}<small>Each brief is checked against these terms before selection.</small></article>
      <article className="creator-signal signal-trust"><span className="signal-icon"><ShieldCheck size={21}/></span><span className="signal-number">05 / EVIDENCE & CONFIDENCE</span><h3>Trust signals</h3><p>{creator.verified_at ? 'Portfolio evidence reviewed by Crevo' : 'Creator-reported profile'}</p><dl><div><dt>Workflow notes</dt><dd>{state.loading ? 'Loading…' : `${work.filter(item => item.workflow?.trim()).length} of ${work.length} work samples`}</dd></div><div><dt>Completed-project reviews</dt><dd>{creator.review_count || 0}</dd></div></dl><small>{creator.verified_at ? 'Reviewed evidence does not guarantee tool licenses or project outcomes.' : 'Independent portfolio review is pending. No verification badge is implied.'}</small></article>
    </div>
  </section>
}
