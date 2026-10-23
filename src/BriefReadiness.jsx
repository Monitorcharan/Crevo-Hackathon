import { formatComplete } from './FormatPicker.jsx'
import './round-two.css'

export function briefChecks(form) {
  return [
    ['Campaign title', form.title.trim().length >= 4],
    ['Goal and audience', form.description.trim().length >= 20],
    ['Specialization', Boolean(form.category)],
    ['Deliverables and quantity', form.deliverables.trim().length >= 10],
    ['Content type and style', Boolean(form.content_type.trim() && form.style.trim())],
    ['Output format and aspect ratio', formatComplete(form.format)],
    ['Commercial-use requirements', Boolean(form.commercial_use.trim())],
    ['Budget', form.budget !== '' && Number.isInteger(Number(form.budget)) && Number(form.budget) >= 0],
    ['Target delivery date', Boolean(form.deadline)],
    ['Included revision rounds', form.revision_rounds !== ''],
    ['Relevant skills', Boolean(form.skills.trim())],
    ['Publishing platforms', Boolean(form.platforms.trim())],
  ]
}

export default function BriefReadiness({ form }) {
  const checks = briefChecks(form), done = checks.filter(([, ready]) => ready).length
  return <section className="brief-readiness" aria-labelledby="readiness-title"><span className="eyebrow">BEFORE YOU PUBLISH</span><h2 id="readiness-title">A clear brief gets better responses.</h2><p>{done} of {checks.length} details added</p><progress value={done} max={checks.length} aria-label="Brief details added"/><ul>{checks.map(([name, ready]) => <li key={name} className={ready ? 'ready' : ''}><span aria-hidden="true">{ready ? '✓' : '○'}</span>{name}<span className="readiness-status">{ready ? 'Added' : 'Missing'}</span></li>)}</ul><small>This checks whether details are present. Review their accuracy, licensing requirements and feasibility yourself.</small></section>
}
