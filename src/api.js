import { firebaseToken } from './firebaseAuth.js'

export const BASE = import.meta.env.VITE_API_BASE || '/api'
export const token = () => localStorage.getItem('crevo_token')
export const setToken = value => value ? localStorage.setItem('crevo_token', value) : localStorage.removeItem('crevo_token')
export const authMode = () => localStorage.getItem('crevo_auth_mode') || (token() ? 'supabase' : '')
export const setAuthMode = value => value ? localStorage.setItem('crevo_auth_mode', value) : localStorage.removeItem('crevo_auth_mode')
export const accessToken = async () => authMode() === 'firebase' ? firebaseToken() : token()
export async function api(path, options = {}) {
  const bearer = await accessToken()
  const headers = { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), ...options.headers }
  const response = await fetch(`${BASE}${path}`, { ...options, headers, body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = Array.isArray(data.detail) ? data.detail.map(item => item.msg).join('; ') : data.detail
    throw new Error(detail || data.message || `Request failed (${response.status})`)
  }
  return data
}
