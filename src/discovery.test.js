import test from 'node:test'
import assert from 'node:assert/strict'
import { creatorMatchesSearch, scoreCreatorForBrief } from './discovery.js'

const creator = {
  name: '[Demo] Aria Vale', title: 'AI filmmaker & campaign director',
  bio: 'Illustrative film concept', location: 'Worldwide',
  categories: ['AI Filmmaking'], skills: ['Creative Direction', 'Storyboarding'],
  platforms: ['Instagram', 'YouTube'], content_types: ['image'], portfolio_tools: [],
}

test('popular video search finds an AI filmmaker even when the portfolio item is an image', () => {
  assert.equal(creatorMatchesSearch(creator, 'Video'), true)
  assert.equal(creatorMatchesSearch(creator, 'video'), true)
  assert.equal(creatorMatchesSearch(creator, 'video nowhere'), false)
})

test('match preview explains field overlap and changes when the category changes', () => {
  const brief = { category: 'AI Filmmaking', skills: 'Creative Direction, Storyboarding', platform: 'Instagram', deliverable: 'Video' }
  const matched = scoreCreatorForBrief(creator, brief)
  assert.equal(matched.score, 100)
  assert.ok(matched.reasons.includes('AI Filmmaking specialty'))
  assert.equal(scoreCreatorForBrief(creator, { ...brief, category: 'Food' }).score, 60)
})
