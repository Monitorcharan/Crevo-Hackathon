import { firebaseToken } from './firebaseAuth.js'

export const BASE = import.meta.env?.VITE_API_BASE || '/api'
export const token = () => localStorage.getItem('crevo_token')
export const setToken = value => {
  if (value) localStorage.setItem('crevo_token', value)
  else for (const key of ['crevo_token', 'crevo_refresh_token', 'crevo_expires_at']) localStorage.removeItem(key)
}
export const authMode = () => localStorage.getItem('crevo_auth_mode') || (token() ? 'supabase' : '')
export const setAuthMode = value => value ? localStorage.setItem('crevo_auth_mode', value) : localStorage.removeItem('crevo_auth_mode')
export function saveSession(result) {
  setToken(result.access_token)
  setAuthMode(result.mode || 'supabase')
  for (const [key, value] of [['crevo_refresh_token', result.refresh_token], ['crevo_expires_at', result.expires_at]]) {
    if (value) localStorage.setItem(key, String(value))
    else localStorage.removeItem(key)
  }
}

function expireSession() {
  setToken(null); setAuthMode(null)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('crevo:session-expired'))
}

function responseError(data, status) {
  const detail = Array.isArray(data.detail) ? data.detail.map(item => item.msg).join('; ') : data.detail
  return Object.assign(new Error(detail || data.message || `Request failed (${status})`), { status })
}

let refreshing
async function refreshSession() {
  if (!refreshing) {
    const previous = localStorage.getItem('crevo_refresh_token')
    if (!previous) { expireSession(); throw new Error('Your session expired. Please log in again.') }
    const renew = async () => {
      // Another tab may have renewed the session while this tab waited for the lock.
      if (localStorage.getItem('crevo_refresh_token') !== previous) {
        if (!token()) throw new Error('Your session expired. Please log in again.')
        return token()
      }
      const response = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: previous }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 401 && localStorage.getItem('crevo_refresh_token') === previous) expireSession()
        throw responseError(data, response.status)
      }
      // Do not restore a session after logout or after signing into another account.
      if (localStorage.getItem('crevo_refresh_token') !== previous) return token()
      saveSession(data)
      return data.access_token
    }
    refreshing = (globalThis.navigator?.locks
      ? navigator.locks.request('crevo-session-refresh', renew) : renew()).finally(() => { refreshing = null })
  }
  return refreshing
}

export async function accessToken() {
  if (authMode() === 'firebase') return firebaseToken()
  const expiresAt = Number(localStorage.getItem('crevo_expires_at'))
  if (token() && localStorage.getItem('crevo_refresh_token') && expiresAt && expiresAt * 1000 < Date.now() + 30000) return refreshSession()
  return token()
}

export async function api(path, options = {}) {
  const publicAuth = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/firebase', '/auth/firebase/config'].includes(path)
  let bearer = publicAuth ? null : await accessToken()
  const send = () => fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), ...options.headers },
    body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body,
  })
  let response = await send()
  if (response.status === 401 && bearer && !publicAuth && authMode() === 'supabase') {
    bearer = token() !== bearer ? token() : await refreshSession()
    if (!bearer) throw new Error('Your session expired. Please log in again.')
    response = await send()
    if (response.status === 401) expireSession()
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw responseError(data, response.status)
  return data
}
