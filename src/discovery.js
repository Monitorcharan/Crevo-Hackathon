const aliases = {
  video: ['video', 'film', 'filmmaking', 'cinematic', 'motion'],
  film: ['film', 'filmmaking', 'video', 'cinematic'],
  motion: ['motion', 'animation', 'video', '3d'],
  photography: ['photography', 'photo', 'imagery', 'still life'],
  ugc: ['ugc', 'social media content', 'social campaigns'],
}

export function creatorMatchesSearch(creator, query) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (!terms.length) return true
  const searchable = [
    creator.name, creator.title, creator.bio, creator.location,
    ...(creator.skills || []), ...(creator.categories || []),
    ...(creator.portfolio_tools || []), ...(creator.content_types || []),
    ...(creator.platforms || []),
  ].join(' ').toLowerCase()
  return terms.every(term => (aliases[term] || [term]).some(word => searchable.includes(word)))
}

export function scoreCreatorForBrief(creator, brief) {
  const category = creator.categories?.includes(brief.category) ? 40 : 0
  const skills = creator.skills || []
  const wanted = brief.skills.toLowerCase().split(',').map(value => value.trim()).filter(Boolean)
  const skillHits = wanted.filter(value => skills.some(skill => skill.toLowerCase().includes(value) || value.includes(skill.toLowerCase())))
  const skillPoints = wanted.length ? Math.round(30 * skillHits.length / wanted.length) : 0
  const platform = creator.platforms?.includes(brief.platform) ? 20 : 0
  const text = [creator.title, ...(creator.categories || []), ...skills, ...(creator.content_types || [])].join(' ').toLowerCase()
  const format = brief.deliverable && (aliases[brief.deliverable.toLowerCase()] || [brief.deliverable.toLowerCase()]).some(word => text.includes(word)) ? 10 : 0
  const reasons = [
    category ? `${brief.category} specialty` : null,
    ...skillHits.map(skill => `${skill} skill`),
    platform ? `${brief.platform} platform` : null,
    format ? `${brief.deliverable} fit` : null,
  ].filter(Boolean)
  return { score: category + skillPoints + platform + format, reasons }
}
