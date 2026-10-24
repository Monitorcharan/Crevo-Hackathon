import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeOpenCall, openCallNextStep, openCallReturnTo } from './opencall-state.js'

const challenge = { id: 'challenge-1', phase: 'submissions', mode: 'hybrid', entries: [], owned: false }

test('a late poll cannot undo a saved vote or selection', () => {
  const saved = { ...challenge, revision: 8, phase: 'selected', winner_id: 'entry' }
  assert.equal(mergeOpenCall(saved, { ...challenge, revision: 7 }), saved)
  assert.equal(mergeOpenCall(saved, { ...saved, revision: 9 }).revision, 9)
  assert.equal(mergeOpenCall(saved, { ...challenge, id: 'other', revision: 0 }).id, 'other')
  const directory = [challenge]
  assert.equal(mergeOpenCall(null, directory), directory)
  assert.deepEqual(mergeOpenCall(directory, []), [])
  assert.equal(mergeOpenCall(null, null), null)
})

test('creators and visitors see the correct next stage', () => {
  assert.equal(openCallNextStep(challenge, 'creator').href, '#submit-work')
  assert.equal(openCallNextStep(challenge).href, '/login?returnTo=%2Fopencall%2Fchallenge-1')
  assert.match(openCallNextStep({ ...challenge, entries: [{ mine: true, status: 'submitted' }] }, 'creator').description, /cannot vote/)
  assert.match(openCallNextStep({ ...challenge, phase: 'voting' }).title, /Voting is open/)
  assert.match(openCallNextStep({ ...challenge, phase: 'judging' }).title, /closed/)
})

test('host controls, withdrawn entries and selected project stay distinct', () => {
  assert.equal(openCallNextStep({ ...challenge, owned: true }).href, '#host-controls')
  assert.equal(openCallNextStep({ ...challenge, owned: true, phase: 'judging' }).href, '#concepts')
  assert.match(openCallNextStep({ ...challenge, entries: [{ mine: true, status: 'withdrawn' }] }, 'creator').description, /cannot be replaced/)
  assert.equal(openCallNextStep({ ...challenge, phase: 'selected', project_id: 'project' }).href, '/projects/project')
  assert.equal(openCallNextStep({ ...challenge, phase: 'selected' }).href, '#concepts')
})

test('post-login OpenCall return paths cannot redirect off site', () => {
  assert.equal(openCallReturnTo('/opencall/challenge-1'), '/opencall/challenge-1')
  for (const value of [null, '//example.com', 'https://example.com', '/\\example.com', '/opencall/../admin', '/opencall/%2fexample.com', '/opencall/one\n']) assert.equal(openCallReturnTo(value), '/dashboard')
})
