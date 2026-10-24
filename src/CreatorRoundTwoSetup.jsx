import { Link } from 'react-router-dom'

export default function CreatorRoundTwoSetup({ readiness }) {
  if (!readiness || readiness.ready) return null
  const pending = readiness.checks.filter(check => !check.complete)
  return <section className="creator-setup-note" aria-label="Matching profile setup">
    <div>
      <span className="eyebrow">YOUR MATCHING PROFILE</span>
      <h2>Get your profile ready for matching.</h2>
      <p>{pending.length} remaining {pending.length === 1 ? 'step' : 'steps'} to help brands evaluate your work.</p>
      <ul>{pending.map(check => <li key={check.key}>
        <Link to={check.href}>{check.label} →</Link>
      </li>)}</ul>
      <p>{readiness.work_samples} work sample{readiness.work_samples === 1 ? '' : 's'} saved. Service listings do not count as portfolio evidence.</p>
    </div>
    <div className="r2-actions">
      <Link className="button button-primary" to="/portfolio/edit">Manage AI portfolio</Link>
      <Link className="button button-outline-dark" to="/profile/edit">Profile & usage rights</Link>
    </div>
  </section>
}
