// Keep an older poll from replacing a vote, evaluation or selection just saved.
export function mergeOpenCall(current, incoming) {
  return current?.id && current.id === incoming?.id && current.revision > incoming.revision ? current : incoming
}

export function openCallReturnTo(value) {
  return typeof value === 'string' && value === value.trim() && /^\/opencall(?:\/[a-zA-Z0-9-]+)?$/.test(value) ? value : '/dashboard'
}

export function openCallNextStep(call, role) {
  const mine = call.entries.find(entry => entry.mine)
  if (call.phase === 'selected') return { title: 'A creator has been selected.', description: call.project_id ? 'Continue with scope, usage rights, production and delivery in your project workspace.' : 'Explore the selected concept and the brand’s evaluation below.', href: call.project_id ? `/projects/${call.project_id}` : '#concepts', label: call.project_id ? 'Open project workspace' : 'See the result' }
  if (call.phase === 'cancelled') return { title: 'This OpenCall has closed.', description: call.cancel_note || 'The host ended this challenge without selecting a creator.', href: '/opencall', label: 'Explore other OpenCalls' }
  if (call.owned) return { title: call.phase === 'submissions' ? 'Collect concepts, then open the next stage.' : call.phase === 'voting' ? 'Community voting is open.' : 'Review the concepts and choose your creator.', description: call.phase === 'submissions' ? 'Entries are open until the deadline. You can close entries early using host controls.' : call.phase === 'voting' ? 'Share this page with visitors. Close voting before evaluating and selecting a creator.' : call.mode === 'community' ? 'Choose a top-voted entry and record your selection reason.' : call.mode === 'hybrid' ? 'Evaluate every visible entry, then select a highest combined score.' : 'Evaluate a concept before selecting its creator.', href: call.phase === 'judging' ? '#concepts' : '#host-controls', label: call.phase === 'judging' ? 'Review concepts' : 'Go to host controls' }
  if (call.phase === 'submissions') {
    if (mine) return { title: mine.status === 'submitted' ? 'Your concept is submitted.' : 'Your entry is no longer public.', description: mine.status === 'submitted' ? 'Your work is in the gallery. Voting starts after submissions close. Participating creators cannot vote while signed in.' : 'One entry per creator is allowed. A withdrawn or removed entry cannot be replaced.', href: '#concepts', label: 'View your entry' }
    if (role === 'creator') return { title: 'Submissions are open. Your turn.', description: 'Read the brief and participation terms, then upload your original concept. Voting opens after entries close.', href: '#submit-work', label: 'Submit your creation' }
    return { title: 'Creators are sharing their concepts.', description: 'Visitors can browse now and vote after submissions close. Sign in as a creator to enter.', href: `/login?returnTo=${encodeURIComponent(`/opencall/${call.id}`)}`, label: 'Log in to enter' }
  }
  if (call.phase === 'voting') return { title: mine ? 'Your work is now in community voting.' : 'Voting is open. Choose your favourite.', description: mine ? 'Participating creators cannot vote while signed in. Share this public page so visitors can discover the concepts.' : 'One choice per browser. Selecting a different concept moves your vote. Cookies must be enabled.', href: '#concepts', label: 'See the concepts' }
  return { title: 'Entries and voting are closed.', description: 'The host is evaluating the concepts and confirming the selected creator. The result will appear here.', href: '#concepts', label: 'Explore the concepts' }
}
