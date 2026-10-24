import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { api } from './api.js'
import { isMemberCreator } from './discovery.js'
import CreatorTile from './CreatorTile.jsx'
import { Reveal } from './StudioMotion.jsx'

export default function CreatorSpotlight() {
  const [state, setState] = useState({ loading: true, creators: [], error: '' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setState(current => ({ ...current, loading: true, error: '' }))
    api('/creators', { signal: controller.signal }).then(creators => {
      if (!controller.signal.aborted) setState({ loading: false, creators: Array.isArray(creators) ? creators : [], error: '' })
    }).catch(() => { if (!controller.signal.aborted) setState({ loading: false, creators: [], error: 'Creator profiles could not be loaded.' }) })
    return () => controller.abort()
  }, [attempt])
  const members = state.creators.filter(isMemberCreator).slice(0, 4)
  return <section className="studio-shell studio-members" id="crevo-creators" aria-labelledby="crevo-creators-title">
    <Reveal className="studio-section-head"><div><span className="studio-kicker">THE CREVO COMMUNITY</span><h2 id="crevo-creators-title">Crevo <em>creators.</em></h2></div><div><p>Explore member profiles, their creative focus, and the work they choose to share.</p><Link className="studio-text-link" to="/discover">Explore the directory <ArrowUpRight size={18}/></Link></div></Reveal>
    {state.loading ? <p className="member-status" role="status">Loading the creative community…</p> : state.error ? <div className="member-status" role="alert"><p>{state.error}</p><button className="studio-button studio-button-dark" onClick={() => setAttempt(value => value + 1)}>Try again</button></div> : <>
      {members.length ? <div className="member-grid">{members.map(creator => <CreatorTile key={creator.id} creator={creator}/>)}</div> : <div className="member-status"><h3>Your work belongs here.</h3><p>Create a profile and share your tools, process, and portfolio.</p><Link className="studio-button studio-button-dark" to="/join">Join as a creator <ArrowUpRight size={18}/></Link></div>}
    </>}
  </section>
}
