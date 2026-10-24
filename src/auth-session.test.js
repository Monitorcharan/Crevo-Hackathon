import test from 'node:test'
import assert from 'node:assert/strict'
import { api, accessToken, saveSession, setToken, token, authMode } from './api.js'

function setup() {
  const values = new Map()
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
  globalThis.window = new EventTarget()
  saveSession({ mode: 'supabase', access_token: 'old-access', refresh_token: 'old-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600 })
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const renewed = () => ({ mode: 'supabase', access_token: 'new-access', refresh_token: 'new-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600 })

test('concurrent requests share one refresh and save rotated credentials', async () => {
  setup()
  localStorage.setItem('crevo_expires_at', '1')
  let refreshes = 0
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/auth/refresh')) {
      refreshes++
      assert.equal(JSON.parse(options.body).refresh_token, 'old-refresh')
      return json(renewed())
    }
    assert.equal(options.headers.Authorization, 'Bearer new-access')
    return json({ ok: true })
  }
  await Promise.all([api('/me'), api('/notifications'), accessToken()])
  assert.equal(refreshes, 1)
  assert.equal(localStorage.getItem('crevo_refresh_token'), 'new-refresh')
})

test('an unauthorized protected request refreshes and retries once', async () => {
  setup()
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push(url)
    if (url.endsWith('/auth/refresh')) return json(renewed())
    return options.headers.Authorization === 'Bearer new-access' ? json({ user: { id: 'user' } }) : json({ detail: 'Invalid or expired session' }, 401)
  }
  assert.equal((await api('/me')).user.id, 'user')
  assert.deepEqual(calls, ['/api/me', '/api/auth/refresh', '/api/me'])
})

test('invalid refresh clears credentials and notifies the application', async () => {
  setup()
  localStorage.setItem('crevo_expires_at', '1')
  let expired = 0
  window.addEventListener('crevo:session-expired', () => expired++)
  globalThis.fetch = async () => json({ detail: 'Your session expired. Please log in again.' }, 401)
  await assert.rejects(accessToken(), /log in again/)
  assert.equal(token(), null)
  assert.equal(localStorage.getItem('crevo_refresh_token'), null)
  assert.equal(authMode(), '')
  assert.equal(expired, 1)
})

test('temporary refresh failures preserve the session for retry', async () => {
  setup()
  localStorage.setItem('crevo_expires_at', '1')
  globalThis.fetch = async () => json({ detail: 'Sign-in is temporarily unavailable.' }, 503)
  await assert.rejects(accessToken(), /temporarily unavailable/)
  assert.equal(token(), 'old-access')
  assert.equal(localStorage.getItem('crevo_refresh_token'), 'old-refresh')
})

test('expired previous sessions cannot block signup or leak a bearer to it', async () => {
  setup()
  localStorage.setItem('crevo_expires_at', '1')
  let calls = 0
  globalThis.fetch = async (url, options) => {
    calls++
    assert.equal(url, '/api/auth/register')
    assert.equal(options.headers.Authorization, undefined)
    return json({ email_confirmation_required: true })
  }
  assert.equal((await api('/auth/register', { method: 'POST', body: { email: 'new@example.com' } })).email_confirmation_required, true)
  assert.equal(calls, 1)
  setToken(null)
  assert.equal(localStorage.getItem('crevo_refresh_token'), null)
})

test('logout during refresh cannot restore the previous session', async () => {
  setup()
  localStorage.setItem('crevo_expires_at', '1')
  globalThis.fetch = async () => { setToken(null); return json(renewed()) }
  assert.equal(await accessToken(), null)
  assert.equal(token(), null)
})
