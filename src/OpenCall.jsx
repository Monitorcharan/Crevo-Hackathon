import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowRight, ArrowUpRight, Check, CheckCircle2, Clock3, Eye, Flag, Globe2, ImagePlus, Plus, RefreshCw, Search, Sparkles, Trophy, Upload, Users, Vote, X } from 'lucide-react'
import { api, BASE } from './api.js'
import { LineReveal, Reveal } from './StudioMotion.jsx'
import { LicenseSummary } from './Licensing.jsx'
import { mergeOpenCall, openCallNextStep } from './opencall-state.js'
import './opencall.css'

const MODES = {
  brand: { label: 'Brand choice', description: 'The brand evaluates concepts and selects its favourite.', Icon: Eye },
  community: { label: 'Community vote', description: 'Visitors vote. The brand confirms a top-voted entry; ties go to the brand.', Icon: Vote },
  hybrid: { label: 'Together, 50 / 50', description: '50% brand evaluation + 50% community support, relative to the leading vote count.', Icon: Users },
}
const PHASES = { submissions: 'Open for entries', voting: 'Voting is open', judging: 'Brand reviewing', selected: 'Creator selected', cancelled: 'Closed without selection' }
const money = value => `$${Number(value || 0).toLocaleString()}`
const date = value => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
const mediaUrl = value => value?.startsWith('/api/') ? `${BASE}${value.slice(4)}` : value
const shortDate = days => { const d = new Date(Date.now() + days * 86400000); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }

function ErrorNotice({ error }) { return error ? <div className="alert" role="alert">{error}</div> : null }
function ModeTag({ mode }) { const { Icon, label } = MODES[mode]; return <span className="oc-mode"><Icon size={13}/>{label}</span> }
function PhaseTag({ phase }) { return <span className={`oc-phase oc-phase-${phase}`}><i/>{PHASES[phase]}</span> }
export function OpenCallBeta() { return <span className="oc-beta" aria-label="Beta">Beta</span> }
function Empty({ title, children }) { return <div className="oc-empty"><Sparkles size={28}/><h3>{title}</h3><p>{children}</p></div> }

function useOpenCall(id, session) {
  const [data, rawSetData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const generation = useRef(0)
  const setData = useCallback(value => rawSetData(current => mergeOpenCall(current, value)), [])
  const refresh = useCallback(async () => {
    const started = generation.current
    try { const value = await api(`/opencall${id ? `/${id}` : ''}`); if (started === generation.current) { setData(value); setError('') } return value }
    catch (e) { if (started === generation.current) setError(e.message); throw e }
    finally { if (started === generation.current) setLoading(false) }
  }, [id, session?.user?.id])
  useEffect(() => { generation.current++; rawSetData(null); setLoading(true); refresh().catch(() => {}); return () => { generation.current++ } }, [refresh])
  useEffect(() => {
    if (!id) return
    const timer = setInterval(() => { if (!document.hidden) refresh().catch(() => {}) }, 20000)
    return () => clearInterval(timer)
  }, [id, refresh])
  return { data, setData, error, loading, refresh }
}

export default function OpenCall({ session }) {
  const { data, error, loading, refresh } = useOpenCall(null, session)
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('all')
  const calls = (data || []).filter(c => `${c.brief.title} ${c.brief.category} ${c.brand.name}`.toLowerCase().includes(query.toLowerCase()) &&
    (filter === 'all' || filter === 'mine' && c.owned || filter === 'open' && c.phase === 'submissions' || filter === 'vote' && c.phase === 'voting' || filter === 'selected' && c.phase === 'selected'))
  return <main className="oc-page">
    <section className="oc-hero"><div className="studio-shell oc-hero-layout"><div>
      <Reveal><span className="studio-kicker"><span className="studio-live"/> CREVO OPENCALL <OpenCallBeta/> / OPEN TO POSSIBILITY</span></Reveal>
      <h1><LineReveal>The brief is open.</LineReveal><LineReveal delay={.1}><em>Make it yours.</em></LineReveal></h1>
      <Reveal delay={.15}><p>A brand brings the spark. Creators bring their own perspective. Discover open briefs, share your work, and help choose what comes next.</p><div className="oc-actions"><a href="#open-briefs" className="studio-button studio-button-lime">Explore OpenCalls <ArrowDown size={17}/></a>{session?.user?.role === 'brand' ? <Link className="studio-text-link" to="/opencall/new">Launch an OpenCall <Plus size={16}/></Link> : <a className="studio-text-link" href="#how-it-works">How it works <ArrowUpRight size={16}/></a>}</div></Reveal>
    </div><Reveal className="oc-hero-art" delay={.2}><div className="oc-orbit oc-orbit-one"/><div className="oc-orbit oc-orbit-two"/><div className="oc-art-sheet"><span>THE NEXT GREAT IDEA</span><div className="oc-art-star" aria-hidden="true">✳</div><strong>Could be<br/><em>yours.</em></strong><div className="oc-art-foot"><span>ONE BRIEF. YOUR PERSPECTIVE.</span><ArrowUpRight size={23}/></div></div><div className="oc-art-label"><Globe2 size={14}/> Open to every creator</div></Reveal></div></section>
    <div className="studio-shell oc-content"><section id="how-it-works" className="oc-how">{[
      ['01', 'A brief goes public.', 'Brands share the direction, budget and selection rules.'],
      ['02', 'Creators make their move.', 'Submit an original image or video concept, with its workflow.'],
      ['03', 'Great work moves forward.', 'Community, brand, or both choose a creator for the project.'],
    ].map(([n, title, text], i) => <Reveal key={n} delay={i * .06}><span>{n} /</span><h3>{title}</h3><p>{text}</p></Reveal>)}</section>
    <section id="open-briefs"><Reveal className="oc-section-head"><div><span className="eyebrow">THE OPEN FLOOR</span><h2>Find your <em>next spark.</em></h2></div><span className="oc-count">{data?.length || 0} OpenCalls</span></Reveal>
      <div className="oc-toolbar"><label className="oc-search"><Search size={17}/><input aria-label="Search OpenCalls" placeholder="Search briefs, brands, creative fields…" value={query} onChange={e => setQuery(e.target.value)}/></label><div className="oc-filters" aria-label="Filter OpenCalls">{[['all', 'All'], ['open', 'Enter'], ['vote', 'Vote'], ['selected', 'Selected'], ...(session?.user?.role === 'brand' ? [['mine', 'My OpenCalls']] : [])].map(([key, label]) => <button key={key} className={filter === key ? 'active' : ''} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div></div>
      <ErrorNotice error={error}/>{error && <button className="studio-text-link" onClick={() => refresh().catch(() => {})}><RefreshCw size={14}/>Try again</button>}
      {loading ? <p className="oc-loading" role="status">Opening the creative floor…</p> : !calls.length ? <Empty title={query || filter !== 'all' ? 'No OpenCalls here yet.' : 'The floor is yours.'}>{query || filter !== 'all' ? 'Try another search or filter.' : 'Brands can turn an existing brief into the first OpenCall.'}{session?.user?.role === 'brand' && <Link to="/opencall/new" className="studio-button studio-button-dark">Launch an OpenCall <Plus size={16}/></Link>}</Empty> : <div className="oc-call-grid">{calls.map((call, i) => <Reveal key={call.id} delay={Math.min(i, 4) * .05}><Link className="oc-call-card" to={`/opencall/${call.id}`}><div className={`oc-call-cover oc-cover-${i % 3}`}><span className="oc-cover-type">{call.brief.category}</span><span className="oc-cover-star" aria-hidden="true">{['✳', '↗', '✦'][i % 3]}</span><PhaseTag phase={call.phase}/></div><div className="oc-call-body"><div className="oc-brand">{call.brand.logo_url && <img src={call.brand.logo_url} alt=""/>}<span>{call.brand.name}</span><ArrowUpRight size={19}/></div><h3>{call.brief.title}</h3><p>{call.brief.description}</p><ModeTag mode={call.mode}/><div className="oc-card-stats"><span><strong>{money(call.brief.budget)}</strong>Project budget</span><span><strong>{call.entry_count}</strong>Entries</span><span><strong>{call.vote_count}</strong>Votes</span></div><div className="oc-card-deadline"><Clock3 size={13}/>{call.phase === 'submissions' ? `Entries until ${date(call.submission_deadline)}` : PHASES[call.phase]}</div></div></Link></Reveal>)}</div>}
    </section></div>
  </main>
}

export function OpenCallNew() {
  const navigate = useNavigate(), [params] = useSearchParams()
  const [briefs, setBriefs] = useState([]), [ready, setReady] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ brief_id: params.get('brief') || '', mode: 'hybrid', submission_deadline: shortDate(7), voting_deadline: shortDate(10), rules: '', public_consent: false })
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))
  useEffect(() => { let active = true; Promise.all([api('/briefs'), api('/opencall'), api('/projects')]).then(([all, calls, projects]) => {
    if (!active) return
    const eligible = all.filter(b => b.status === 'open' && !calls.some(c => c.brief_id === b.id) && !projects.some(p => p.brief_id === b.id))
    setBriefs(eligible); setForm(f => ({ ...f, brief_id: eligible.some(b => b.id === f.brief_id) ? f.brief_id : eligible[0]?.id || '' }))
  }).catch(e => active && setError(e.message)).finally(() => active && setReady(true)); return () => { active = false } }, [])
  const chosen = briefs.find(b => b.id === form.brief_id)
  async function launch(e) {
    e.preventDefault(); setBusy(true); setError('')
    try { const call = await api('/opencall', { method: 'POST', body: { ...form, submission_deadline: new Date(form.submission_deadline).toISOString(), voting_deadline: new Date(form.voting_deadline).toISOString() } }); navigate(`/opencall/${call.id}`, { state: { launched: true } }) }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <main className="oc-page"><div className="studio-shell oc-content oc-new"><Link className="back-link" to="/opencall">← OpenCall</Link><Reveal><span className="eyebrow">OPENCALL <OpenCallBeta/> / INVITE A WORLD OF PERSPECTIVES</span><h1>Open the <em>possibilities.</em></h1><p className="oc-lead">Your brief. An open invitation. Choose how the next creative collaboration begins.</p></Reveal><ErrorNotice error={error}/>{!ready ? <p role="status">Loading your briefs…</p> : !briefs.length ? <Empty title="Start with an open brief.">An OpenCall needs one of your open briefs with no existing project or OpenCall.<Link to="/briefs/new" className="studio-button studio-button-dark">Create a brief <ArrowUpRight size={16}/></Link></Empty> : <div className="oc-new-grid"><form className="oc-form" onSubmit={launch}>
    <label>Choose your brief<select required value={form.brief_id} onChange={e => set('brief_id', e.target.value)}>{briefs.map(b => <option value={b.id} key={b.id}>{b.title}</option>)}</select></label>
    <fieldset><legend>How will you choose?</legend><div className="oc-mode-options">{Object.entries(MODES).map(([key, { label, description, Icon }]) => <label key={key} className={form.mode === key ? 'selected' : ''}><input type="radio" name="mode" value={key} checked={form.mode === key} onChange={() => set('mode', key)}/><Icon size={21}/><span><strong>{label}</strong><small>{description}</small></span><Check size={16} className="oc-radio-check"/></label>)}</div></fieldset>
    <div className="oc-two"><label>Submission deadline<input required type="datetime-local" value={form.submission_deadline} onChange={e => set('submission_deadline', e.target.value)}/></label><label>{form.mode === 'brand' ? 'Review deadline' : 'Voting deadline'}<input required type="datetime-local" min={form.submission_deadline} value={form.voting_deadline} onChange={e => set('voting_deadline', e.target.value)}/></label></div>
    <label>Participation terms<textarea required minLength={30} maxLength={2500} rows={6} value={form.rules} onChange={e => set('rules', e.target.value)} placeholder="Describe the concept you expect, selection criteria, any participation compensation and what the selected creator will deliver."/><small>State whether participation is paid or unpaid. The project budget is not a guaranteed payment to every entrant. Creators retain ownership; entering and voting grant no commercial usage rights.</small></label>
    <label className="oc-check"><input type="checkbox" required checked={form.public_consent} onChange={e => set('public_consent', e.target.checked)}/><span>I can publish this brief and its requirements publicly. I understand the mode and terms become fixed when launched.</span></label><p className="oc-fine-print">Deadlines use your local time. The brand may close entries or voting early; every stage change is recorded publicly. Voting is limited to one choice per browser and is not verified one-person voting. Ties are decided by the brand.</p><button className="studio-button studio-button-dark" disabled={busy}>{busy ? 'Launching…' : 'Launch OpenCall'}<ArrowUpRight size={17}/></button>
    </form><aside className="oc-brief-preview"><span className="eyebrow">GOING PUBLIC</span><div className="oc-preview-symbol" aria-hidden="true">↗</div><h2>{chosen?.title}</h2><p>{chosen?.description}</p><div className="oc-preview-facts"><span><small>PROJECT BUDGET</small><strong>{money(chosen?.budget)}</strong></span><span><small>OUTPUT</small><strong>{chosen?.format || chosen?.content_type || 'Creative concept'}</strong></span></div><LicenseSummary terms={chosen?.licensing} title="Required project usage rights"/><p className="oc-fine-print">The selected creator continues into Crevo’s existing scope, licensing, production and delivery workspace.</p></aside></div>}</div></main>
}

function EntryForm({ call, onSubmitted }) {
  const [form, setForm] = useState({ title: '', description: '', tools: '', workflow: '', consent: false }), [file, setFile] = useState(null), [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => { if (!file) { setPreview(''); return } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url) }, [file])
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      if (!file || file.size > 50 * 1024 * 1024) throw new Error('Choose an image or MP4 no larger than 50 MB.')
      const body = new FormData(); Object.entries(form).forEach(([k, v]) => body.append(k, v)); body.append('file', file)
      onSubmitted(await api(`/opencall/${call.id}/entries`, { method: 'POST', body }))
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <section id="submit-work" className="oc-submit"><div><span className="eyebrow">YOUR PERSPECTIVE BELONGS HERE</span><h2>Make your <em>move.</em></h2><p>Share one original concept. Your preview, tools and workflow will be public. Submit work you are comfortable displaying; use a watermarked preview if needed.</p><div className="oc-submit-note"><Globe2 size={18}/><span>Ownership stays with you. Commercial use needs an agreement in the project workspace.</span></div></div><form className="oc-form" onSubmit={submit}><label className="oc-upload">{preview ? file.type.startsWith('video/') ? <video src={preview} controls aria-label="Your submission preview"/> : <img src={preview} alt="Your submission preview"/> : <span><ImagePlus size={30}/><strong>Choose your concept preview</strong><small>PNG, JPEG, WebP or MP4 · up to 50 MB</small></span>}<input required type="file" accept="image/png,image/jpeg,image/webp,video/mp4" aria-label="Submission preview file" onChange={e => setFile(e.target.files?.[0] || null)} disabled={busy}/></label>{file && <small>{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</small>}
      <label>Concept title<input required minLength={3} maxLength={140} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Give your perspective a name"/></label><label>Your creative approach<textarea required minLength={20} maxLength={2000} rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="How does this concept answer the brief?"/></label><label>Tools and models used<input required maxLength={500} value={form.tools} onChange={e => set('tools', e.target.value)} placeholder="Separate the tools you actually used with commas"/></label><label>Production workflow<textarea required minLength={20} maxLength={2000} rows={3} value={form.workflow} onChange={e => set('workflow', e.target.value)} placeholder="Explain your process and any important source material."/></label><label className="oc-check"><input required type="checkbox" checked={form.consent} onChange={e => set('consent', e.target.checked)}/><span>I can publicly share this work and accept the participation terms above. I understand this is one final entry and participation does not guarantee selection or payment.</span></label><ErrorNotice error={error}/><button disabled={busy} className="studio-button studio-button-dark">{busy ? 'Uploading your concept…' : 'Submit your creation'}<Upload size={16}/></button>
    </form></section>
}

function EntryCard({ entry, call, busy, onVote, onManage }) {
  const winner = entry.id === call.winner_id, voted = entry.id === call.my_vote
  const canVote = call.phase === 'voting' && call.mode !== 'brand' && !call.owned && !call.entries.some(e => e.mine)
  return <article className={`oc-entry ${winner ? 'oc-entry-winner' : ''} ${entry.status !== 'submitted' ? 'oc-entry-muted' : ''}`}>
    <div className="oc-entry-media">{entry.status !== 'submitted' ? <div className="oc-hidden-media"><Flag size={25}/><span>{entry.status === 'hidden' ? 'Entry removed by host' : 'Entry withdrawn'}</span></div> : entry.media.media_type === 'video' ? <video controls preload="metadata" src={mediaUrl(entry.media.url)} aria-label={entry.title}/> : <a href={mediaUrl(entry.media.url)} target="_blank" rel="noopener noreferrer"><img loading="lazy" src={mediaUrl(entry.media.url)} alt={entry.title}/></a>}{winner && <span className="oc-winner-badge"><Trophy size={14}/>Selected concept</span>}{entry.mine && <span className="oc-your-entry">YOUR ENTRY</span>}</div>
    <div className="oc-entry-body"><div className="oc-entry-byline"><Link to={`/creators/${entry.creator_id}`}>{entry.creator.avatar_url && <img src={entry.creator.avatar_url} alt=""/>}{entry.creator.name}<ArrowUpRight size={12}/></Link><span>{entry.media.width} × {entry.media.height}</span></div><h3>{entry.title}</h3><p>{entry.description}</p><div className="oc-tools">{entry.tools.map(tool => <span key={tool}>{tool}</span>)}</div><details className="oc-process"><summary>Behind the concept <Plus size={13}/></summary><p>{entry.workflow}</p><small>Tools and workflow are creator reported.</small></details>{entry.moderation_note && <p className="oc-fine-print">Host’s reason: {entry.moderation_note}</p>}
      {entry.evaluation && <div className="oc-evaluation"><strong>Brand evaluation · {entry.evaluation.score}/100</strong><p>{entry.evaluation.note}</p>{call.mode === 'hybrid' && entry.score !== null && <small>Combined score: {Number(entry.score).toFixed(1)}/100</small>}</div>}
      {call.owned && entry.licensing?.status !== 'compatible' && entry.status === 'submitted' && <p className="oc-rights-warning">Usage rights: {entry.licensing?.status || 'unconfirmed'}. Confirm coverage before selection.</p>}
      <div className="oc-entry-bottom">{call.mode !== 'brand' && <button type="button" className={`oc-vote ${voted ? 'is-voted' : ''}`} disabled={busy || !canVote || entry.status !== 'submitted'} aria-pressed={voted} aria-label={`${voted ? 'Your vote for' : 'Vote for'} ${entry.title}, ${entry.votes} votes`} onClick={() => onVote(entry.id)}>{voted ? <CheckCircle2 size={16}/> : <Vote size={16}/>}<strong>{entry.votes}</strong><span>{voted ? 'Your vote' : canVote ? 'Vote' : 'Votes'}</span></button>}{call.owned && call.phase === 'judging' && entry.status === 'submitted' && <div className="oc-entry-admin">{call.mode !== 'community' && <button className="oc-small-button" disabled={busy} onClick={() => onManage('evaluate', entry)}>Evaluate</button>}<button className="oc-small-button oc-small-dark" disabled={busy} onClick={() => onManage('select', entry)}>Select creator <ArrowUpRight size={13}/></button></div>}</div>
      <div className="oc-entry-secondary">{entry.mine && call.phase === 'submissions' && entry.status === 'submitted' && <button disabled={busy} onClick={() => onManage('withdraw', entry)}>Withdraw entry</button>}{call.owned && !['selected', 'cancelled'].includes(call.phase) && entry.status === 'submitted' && <button disabled={busy} onClick={() => onManage('hide', entry)}>Remove inappropriate entry</button>}</div>
    </div>
  </article>
}

export function OpenCallDetail({ session }) {
  const { id } = useParams()
  const { data: call, setData, error: loadError, loading, refresh } = useOpenCall(id, session)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [sort, setSort] = useState('newest')
  const [manage, setManage] = useState(null), [note, setNote] = useState(''), [score, setScore] = useState(75)
  const panel = useRef(null)
  useEffect(() => { setError(''); setNotice(''); setManage(null) }, [id])
  function openManage(action, entry = null) { setManage({ action, entry }); setNote(action === 'evaluate' ? entry.evaluation?.note || '' : ''); setScore(entry?.evaluation?.score ?? 75); setError(''); setTimeout(() => panel.current?.scrollIntoView({ behavior: document.documentElement.dataset.studioMotion === 'off' ? 'auto' : 'smooth', block: 'center' }), 0) }
  async function act(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const value = await api(`/opencall/${id}/actions`, { method: 'POST', body: { revision: call.revision, action: manage.action, entry_id: manage.entry?.id || '', note, score: Number(score) } })
      setData(value); setManage(null); setNotice(manage.action === 'select' ? 'Creator selected. Your project workspace is ready for scope and licensing.' : 'OpenCall updated.')
    } catch (e) { setError(e.message); if (e.status === 409) refresh().catch(() => {}) } finally { setBusy(false) }
  }
  async function vote(entry_id) {
    setBusy(true); setError('')
    try { setData(await api(`/opencall/${id}/vote`, { method: 'POST', headers: { 'X-Crevo-Vote': '1' }, body: { entry_id } })); setNotice('Your vote is saved. Voting for another entry moves your vote.') }
    catch (e) { setError(e.message); if (e.status === 409) refresh().catch(() => {}) } finally { setBusy(false) }
  }
  if (!call) return <main className="oc-page"><div className="studio-shell oc-content"><Link className="back-link" to="/opencall">← OpenCall</Link><ErrorNotice error={loadError}/><p role="status">{loading ? 'Opening this brief…' : 'Unable to load this OpenCall.'}</p>{!loading && <button className="studio-text-link" onClick={() => refresh().catch(() => {})}>Try again <RefreshCw size={14}/></button>}</div></main>
  const mine = call.entries.find(e => e.mine)
  const nextStep = openCallNextStep(call, session?.user?.role)
  const entries = [...call.entries].sort((a, b) => a.id === call.winner_id ? -1 : b.id === call.winner_id ? 1 : sort === 'votes' ? b.votes - a.votes : sort === 'score' ? (b.score ?? -1) - (a.score ?? -1) : b.created_at.localeCompare(a.created_at))
  const requiresNote = manage && ['evaluate', 'select', 'hide', 'cancel'].includes(manage.action)
  const actionTitles = { close_submissions: call.mode === 'brand' ? 'Close entries and begin reviewing?' : 'Close entries and open voting?', close_voting: 'Close voting and begin reviewing?', evaluate: 'Evaluate this concept', select: 'Select this creator?', hide: 'Remove this entry from the public gallery?', withdraw: 'Withdraw your entry?', cancel: 'Close this OpenCall without a selection?' }
  return <main className="oc-page"><section className="oc-detail-hero"><div className="studio-shell"><Link className="back-link" to="/opencall">← All OpenCalls</Link><Reveal><div className="oc-detail-tags"><OpenCallBeta/><PhaseTag phase={call.phase}/><ModeTag mode={call.mode}/></div><span className="oc-detail-brand">{call.brand.logo_url && <img src={call.brand.logo_url} alt=""/>}{call.brand.name} / {call.brief.category}</span><h1>{call.brief.title}<em>.</em></h1><div className="oc-detail-metrics"><span><strong>{money(call.brief.budget)}</strong>PROJECT BUDGET</span><span><strong>{call.entry_count}</strong>CREATIVE ENTRIES</span>{call.mode !== 'brand' && <span><strong>{call.vote_count}</strong>COMMUNITY VOTES</span>}<a href="#concepts" className="studio-button studio-button-lime">See the concepts <ArrowDown size={16}/></a></div></Reveal></div></section>
    <div className="studio-shell oc-content"><ErrorNotice error={loadError || error}/>{notice && <div className="notice" role="status">{notice}</div>}
    <section className="oc-next-step" aria-label="Your next step"><div><span className="eyebrow">OPENCALL <OpenCallBeta/> / YOUR NEXT STEP</span><h3>{nextStep.title}</h3><p>{nextStep.description}</p></div><div className="oc-next-actions">{nextStep.href.startsWith('#') ? <a className="studio-button studio-button-dark" href={nextStep.href}>{nextStep.label}<ArrowRight size={16}/></a> : <Link className="studio-button studio-button-dark" to={nextStep.href}>{nextStep.label}<ArrowUpRight size={16}/></Link>}<button className="studio-text-link" onClick={async () => { const url = `${window.location.origin}/opencall/${id}`; try { await navigator.clipboard.writeText(url); setNotice('Public OpenCall link copied. Visitors can browse and vote when voting opens.') } catch { setNotice(`Share this public link: ${url}`) } }}>Copy public link <Globe2 size={14}/></button></div></section>
    {call.phase === 'selected' && <Reveal className="oc-result"><Trophy size={30}/><div><span className="eyebrow">A NEW COLLABORATION BEGINS</span><h2>The next chapter is in motion.</h2><p>{call.selection_note}</p></div>{call.project_id && <Link className="studio-button studio-button-dark" to={`/projects/${call.project_id}`}>Open project workspace <ArrowUpRight size={16}/></Link>}</Reveal>}
    {call.phase === 'cancelled' && <div className="notice">This OpenCall closed without a selection. {call.cancel_note}</div>}
    <div className="oc-brief-grid"><Reveal><span className="eyebrow">THE CREATIVE CHALLENGE</span><h2>The <em>brief.</em></h2><p className="oc-description">{call.brief.description}</p><div className="oc-specs">{[['DELIVERABLES', call.brief.deliverables], ['CONTENT', call.brief.content_type], ['STYLE', call.brief.style], ['FORMAT', call.brief.format], ['TOOLS', call.brief.required_tools?.join(', ')], ['SKILLS', call.brief.skills?.join(', ')], ['TARGET DELIVERY', call.brief.deadline]].filter(([, v]) => v).map(([k, v]) => <div key={k}><strong>{k}</strong><span>{v}</span></div>)}</div><LicenseSummary terms={call.brief.licensing} title="Required project usage rights"/></Reveal>
    <Reveal className="oc-rules"><span className="eyebrow">KNOW BEFORE YOU CREATE</span><h3>How this OpenCall works</h3><ModeTag mode={call.mode}/><p>{MODES[call.mode].description}</p><div className="oc-deadlines"><span><Clock3 size={15}/>Entries close<strong>{date(call.submission_deadline)}</strong></span><span><Clock3 size={15}/>{call.mode === 'brand' ? 'Review target' : 'Voting closes'}<strong>{date(call.voting_deadline)}</strong></span></div><h4>Participation terms</h4><p className="oc-preserve">{call.rules}</p><div className="oc-rules-footer"><p>Creators retain ownership. Public entry and voting grant no commercial-use rights. The project budget applies to the selected engagement; compensation for participation follows the terms above.</p><p>One entry per creator. One vote per browser; you can move your vote. Browser voting is not identity verified. Host brands may close stages early. The brand resolves top-score ties and confirms the selection.</p>{call.mode === 'hybrid' && <p>Combined score = 50% brand score + 50% × (entry votes ÷ highest entry votes × 100). No votes gives a community component of zero. All entries must be evaluated before selection.</p>}</div></Reveal></div>
    {call.owned && !['selected', 'cancelled'].includes(call.phase) && <Reveal className="oc-host" as="section"><span id="host-controls" className="oc-anchor"/><div><span className="eyebrow">HOST CONTROLS</span><h3>{PHASES[call.phase]}</h3><p>Stage changes are recorded below. Selection continues into the existing project flow.</p></div><div className="oc-actions">{call.phase === 'submissions' && <button className="studio-button studio-button-dark" disabled={busy} onClick={() => openManage('close_submissions')}>{call.mode === 'brand' ? 'Close entries & review' : 'Close entries & open voting'}<ArrowRight size={15}/></button>}{call.phase === 'voting' && <button className="studio-button studio-button-dark" disabled={busy} onClick={() => openManage('close_voting')}>Close voting & review <ArrowRight size={15}/></button>}<button className="studio-text-link" disabled={busy} onClick={() => openManage('cancel')}>Cancel OpenCall</button></div></Reveal>}
    <div ref={panel}>{manage && <form className="oc-manage oc-form" onSubmit={act} aria-label={actionTitles[manage.action]}><div className="oc-section-head"><h3>{actionTitles[manage.action]}</h3><button type="button" className="oc-close" aria-label="Close action panel" onClick={() => setManage(null)} disabled={busy}><X size={20}/></button></div>{manage.entry && <strong>{manage.entry.title} · {manage.entry.creator.name}</strong>}{manage.action === 'select' && <p>This records the winner, creates one project, and closes this brief to new applications. Confirm scope and licensing with the creator before production.</p>}{manage.action === 'withdraw' && <p>Your preview will be removed from public view. You cannot submit a replacement entry to this OpenCall.</p>}{manage.action === 'evaluate' && <label>Brand score (0–100)<input type="number" min="0" max="100" required value={score} onChange={e => setScore(e.target.value)}/></label>}{requiresNote && <label>{manage.action === 'evaluate' ? 'Evaluation rationale (published with the result)' : 'Public reason'}<textarea required minLength={20} maxLength={2000} rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder={manage.action === 'select' ? 'Explain the selection and any tie decision.' : 'Describe your reasoning.'}/></label>}<ErrorNotice error={error}/><button disabled={busy} className="studio-button studio-button-dark">{busy ? 'Saving…' : manage.action === 'select' ? 'Confirm selection & create project' : 'Confirm'}<Check size={16}/></button></form>}</div>
    <section id="concepts" className="oc-concepts"><Reveal className="oc-section-head"><div><span className="eyebrow">DIFFERENT MINDS. SHARED POSSIBILITY.</span><h2>The <em>concepts.</em></h2></div><div className="oc-sort"><button className="oc-refresh" aria-label="Refresh submissions and votes" disabled={busy} onClick={() => refresh().catch(() => {})}><RefreshCw size={16}/></button><label>Sort<select value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Newest first</option>{call.mode !== 'brand' && <option value="votes">Most votes</option>}{call.owned && call.mode !== 'community' && <option value="score">Highest score</option>}</select></label></div></Reveal>
    {call.phase === 'voting' && <p className="oc-gallery-note"><Vote size={16}/>Choose your favourite. Your next vote replaces your previous choice. Cookies must be enabled.</p>}
    {entries.length ? <div className="oc-entry-grid">{entries.map((entry, i) => <Reveal key={entry.id} delay={Math.min(i, 4) * .04}><EntryCard entry={entry} call={call} busy={busy} onVote={vote} onManage={openManage}/></Reveal>)}</div> : <Empty title="The next idea could be yours.">{call.phase === 'submissions' ? 'Be the first creator to answer this brief.' : 'No public submissions to show.'}</Empty>}
    </section>
    {call.phase === 'submissions' && !mine && (session?.user?.role === 'creator' ? <EntryForm call={call} onSubmitted={value => { setData(value); setNotice('Your concept is live. You can find it in the gallery above.'); document.getElementById('concepts')?.scrollIntoView({ behavior: 'auto' }) }}/> : !session && <section className="oc-join"><Sparkles size={30}/><h2>Have a different perspective?</h2><p>Sign in as a creator to submit your work. Visitors can browse and vote when voting opens.</p><Link className="studio-button studio-button-dark" to={`/login?returnTo=${encodeURIComponent(`/opencall/${id}`)}`}>Log in to create <ArrowUpRight size={16}/></Link></section>)}
    <details className="oc-history"><summary>OpenCall activity <Plus size={16}/></summary><ol>{call.events.map((event, i) => <li key={i}><span>{event.action.replaceAll('_', ' ')}</span><time>{date(event.at)}</time>{event.note && <p>{event.note}</p>}</li>)}</ol></details>
    </div>
  </main>
}
