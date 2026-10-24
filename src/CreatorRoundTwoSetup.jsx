import { Link } from 'react-router-dom'

export default function CreatorRoundTwoSetup({ readiness }) {
  if (!readiness) return null
  return <section className="creator-setup-note" aria-label="Round 2 account setup">
    <div>
      <span className="eyebrow">ROUND 2 / YOUR EXISTING ACCOUNT</span>
      <h2>{readiness.ready ? 'Your matching essentials are saved.' : 'Get your profile ready for matching.'}</h2>
      <p>Matching, invitations, agreements and deliveries are available on this account. Complete the evidence and rights brands use to evaluate your work.</p>
      <ul>{readiness.checks.map(check => <li key={check.key}>
        <strong>{check.complete ? 'Saved' : 'To do'}:</strong>{' '}
        {check.complete ? check.label : <Link to={check.href}>{check.label} →</Link>}
      </li>)}</ul>
      <p>{readiness.work_samples} work sample{readiness.work_samples === 1 ? '' : 's'} saved. Service listings do not count as portfolio evidence.</p>
    </div>
    <div className="r2-actions">
      <Link className="button button-dark" to="/portfolio/edit">Manage AI portfolio</Link>
      <Link className="button button-outline-dark" to="/profile/edit">Profile & usage rights</Link>
    </div>
  </section>
}
