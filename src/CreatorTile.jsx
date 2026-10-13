import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { VerifiedBadge } from './CreatorTrust.jsx'
import { isDemoCreator } from './discovery.js'
import { demoPortraits } from './demoPortraits.js'
import categoryPhotos from './categoryPhotos.json'

export function CreatorPhoto({ creator, className = '' }) {
  const demo = isDemoCreator(creator)
  const portrait = demo ? demoPortraits[creator.name] : null
  const category = categoryPhotos[(creator.categories || [])[0]]
  const source = demo ? portrait?.image || category?.image : creator.avatar_url
  const [failedSource, setFailedSource] = useState(null)
  const initial = (creator.name || 'Creator').replace(/^\[Demo\]\s*/i, '').split(/\s+/).map(part => part[0]).slice(0, 2).join('')
  return <div className={`member-photo ${className}`}>
    {source && source !== failedSource ? <img src={source} alt={demo ? portrait ? 'Stock portrait illustrating a fictional demo creator' : 'Category photograph illustrating a fictional demo creator' : creator.name} loading="lazy" onError={() => setFailedSource(source)}/> : <div className="member-photo-initials" aria-label={`${creator.name}: no profile photo uploaded`}><span>{initial}</span><small>PHOTO NOT ADDED</small></div>}
    <span className={`member-kind ${demo ? 'member-kind-demo' : ''}`}>{demo ? 'FICTIONAL DEMO' : 'CREVO MEMBER'}</span>
    {demo && source && <span className="member-photo-note">{portrait ? 'STOCK PHOTO · NOT A MEMBER' : 'CATEGORY PHOTOGRAPH'}</span>}
  </div>
}

export function CreatorPhotoCredit({ creator }) {
  if (!isDemoCreator(creator)) return null
  const portrait = demoPortraits[creator.name]
  const category = categoryPhotos[(creator.categories || [])[0]]
  const source = portrait || category
  if (!source) return null
  return <p className="member-photo-credit">Photo: <a href={source.source} target="_blank" rel="noopener noreferrer">{portrait?.credit || category.creator}</a> · {portrait ? <a href="https://unsplash.com/license" target="_blank" rel="noopener noreferrer">Unsplash License</a> : `CC ${category.license.toUpperCase()}`}</p>
}

export default function CreatorTile({ creator }) {
  const demo = isDemoCreator(creator)
  return <article className="creator-card member-card">
    <Link to={`/creators/${creator.id}`} className="member-photo-link" aria-label={`View ${creator.name}`}><CreatorPhoto creator={creator}/><span className="member-arrow"><ArrowUpRight size={21}/></span></Link>
    <div className="member-card-content"><div className="member-card-heading"><h3><Link to={`/creators/${creator.id}`}>{creator.name.replace(/^\[Demo\]\s*/i, '')}</Link></h3>{!demo && <VerifiedBadge verifiedAt={creator.verified_at}/>}</div><p className="member-craft">{creator.title || 'Creative professional'}</p>
      <div className="member-skills">{[...(creator.categories || []).slice(0, 1), ...(creator.skills || []).slice(0, 2), ...(creator.portfolio_tools || []).slice(0, 2)].map((tag, index) => <span key={`${tag}-${index}`}>{tag}</span>)}</div>
      <p className="member-caption">{demo ? 'Fictional sample. Explore the portfolio and workflow; not available for hire.' : creator.bio || 'This member is building their profile. Explore their details and published work.'}</p>
      <Link className="member-portfolio-link" to={`/creators/${creator.id}/work`}>{demo ? 'Explore demo portfolio' : 'View portfolio'}<ArrowUpRight size={16}/></Link>
      <CreatorPhotoCredit creator={creator}/>
    </div>
  </article>
}
