import { BrandLogo } from './BrandMark.jsx'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { api } from './api.js'
import { briefCategories } from './categories.js'

const csv = text => text.split(',').map(x => x.trim()).filter(Boolean)
const initialForm = { title: '', description: '', category: '', skills: '', platforms: '', budget: '', location: '', content_type: '', style: '', format: '', commercial_use: '' }

export default function BriefBuilder() {
  const navigate = useNavigate()
  const formRef = useRef(null)
  const [form, setForm] = useState(initialForm)
  const [idea, setIdea] = useState('')
  const [draftSource, setDraftSource] = useState('')
  const [draftNotice, setDraftNotice] = useState('')
  const [draftError, setDraftError] = useState('')
  const [publishError, setPublishError] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    api('/me').then(data => {
      if (data.user.role !== 'brand') navigate('/dashboard')
    }).catch(() => navigate('/login'))
  }, [navigate])

  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))

  async function draft() {
    setDrafting(true)
    setDraftError('')
    setDraftNotice('')
    try {
      const result = await api('/briefs/draft', { method: 'POST', body: { idea } })
      setForm(current => {
        const next = { ...current }
        for (const key of ['title', 'description', 'category', 'content_type', 'style', 'format', 'commercial_use', 'location']) {
          if (result[key]) next[key] = result[key]
        }
        for (const key of ['skills', 'platforms']) {
          if (result[key]?.length) next[key] = result[key].join(', ')
        }
        return next
      })
      setDraftSource(result.source)
      setDraftNotice('AI draft added to the form. Review the details and fill in anything missing before publishing.')
      requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch (error) {
      setDraftError(error.message)
    } finally {
      setDrafting(false)
    }
  }

  async function publish(event) {
    event.preventDefault()
    setPublishing(true)
    setPublishError('')
    try {
      const brief = await api('/briefs', {
        method: 'POST',
        body: { ...form, skills: csv(form.skills), platforms: csv(form.platforms), budget: Number(form.budget) },
      })
      navigate(`/briefs/${brief.id}`, { state: { published: true } })
    } catch (error) {
      setPublishError(error.message)
    } finally {
      setPublishing(false)
    }
  }

  return <main className="brief-builder">
    <div className="brief-builder-nav"><BrandLogo/><Link to="/dashboard">← Dashboard</Link></div>
    <div className="brief-builder-content">
      <span className="eyebrow">BRAND STUDIO / NEW BRIEF</span>
      <h1>Start with an <em>idea.</em></h1>
      <p>Give creators the context they need to make work that fits. You can refine everything before publishing.</p>
      <div className="brief-builder-grid">
        <div>
          <div className="idea-panel" aria-busy={drafting}>
            <span className="eyebrow">OPTIONAL AI ASSIST</span>
            <h2>From rough thought to clear direction.</h2>
            <textarea aria-label="Campaign idea" value={idea} onChange={event => setIdea(event.target.value)} rows={4} placeholder="Describe the campaign in your own words…"/>
            <button className="button button-dark" type="button" disabled={drafting || publishing || idea.trim().length < 20} onClick={draft}>
              {drafting ? <span className="brief-spinner" aria-hidden="true"/> : <Sparkles size={17}/>}
              {drafting ? 'Generating your draft…' : draftSource ? 'Regenerate draft fields' : 'Draft brief fields'}
            </button>
            {drafting && <div className="brief-progress" role="status">AI is turning your idea into editable brief fields…</div>}
            {draftError && <div className="alert" role="alert">{draftError}</div>}
            {draftNotice && <div className="brief-draft-notice" role="status"><Check size={19}/><span>{draftNotice} <strong>This is a draft; it has not been published yet.</strong></span></div>}
            <small>Uses the configured AI provider. Review every suggested field before publishing.</small>
          </div>
          <div className="brief-tip"><span className="eyebrow">A STRONG BRIEF INCLUDES</span><p>What you want to make, who it is for, the visual direction, deliverables, usage rights, and budget.</p></div>
        </div>
        <form ref={formRef} className={`portfolio-form ${draftSource ? 'brief-form-drafted' : ''}`} onSubmit={publish} aria-busy={publishing}>
          <span className="eyebrow">CAMPAIGN DETAILS</span>
          <h2>{draftSource ? 'AI draft added — review it' : 'Build the brief'}</h2>
          {draftSource && <div className="brief-form-status" role="status"><Check size={19}/><span>Suggested fields are in this form. Check and complete them, then publish your brief.</span></div>}
          <label>Project title<input required minLength={4} value={form.title} onChange={event => set('title', event.target.value)} placeholder="A clear name for your campaign"/></label>
          <label>Description {draftSource && <small>AI assisted draft · please review every detail</small>}<textarea required minLength={20} rows={6} value={form.description} onChange={event => set('description', event.target.value)} placeholder="Goal, deliverables, tone and audience"/></label>
          <div className="form-two">
            <label>Category<select required value={form.category} onChange={event => set('category', event.target.value)}><option value="">Choose a category</option>{briefCategories.map(category => <option key={category}>{category}</option>)}</select></label>
            <label>Budget (USD)<input required type="number" min="0" value={form.budget} onChange={event => set('budget', event.target.value)} placeholder="2500"/></label>
          </div>
          <div className="form-two">
            <label>Content type<input required value={form.content_type} onChange={event => set('content_type', event.target.value)} placeholder="AI film, animation, images"/></label>
            <label>Format / aspect ratio<input required value={form.format} onChange={event => set('format', event.target.value)} placeholder="9:16, 30 seconds"/></label>
          </div>
          <label>Visual style<input required value={form.style} onChange={event => set('style', event.target.value)} placeholder="Cinematic, vibrant, editorial"/></label>
          <label>Commercial-use requirements<textarea required rows={3} value={form.commercial_use} onChange={event => set('commercial_use', event.target.value)} placeholder="Where and for how long will the work be used?"/></label>
          <div className="form-two">
            <label>Skills needed<input value={form.skills} onChange={event => set('skills', event.target.value)} placeholder="AI video, Editing"/></label>
            <label>Platforms<input value={form.platforms} onChange={event => set('platforms', event.target.value)} placeholder="Instagram, TikTok"/></label>
          </div>
          <label>Location preference<input value={form.location} onChange={event => set('location', event.target.value)} placeholder="Optional"/></label>
          {publishError && <div className="alert" role="alert">{publishError}</div>}
          <button className="button button-primary" disabled={drafting || publishing}>{publishing ? 'Publishing brief…' : 'Publish brief'} <ArrowRight size={17}/></button>
        </form>
      </div>
    </div>
  </main>
}
