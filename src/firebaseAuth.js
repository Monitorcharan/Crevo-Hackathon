import { initializeApp, getApps } from 'firebase/app'
import { getAuth, GoogleAuthProvider, FacebookAuthProvider, OAuthProvider, signInWithPopup, signOut } from 'firebase/auth'

let configPromise
let authPromise

export function firebaseConfig() {
  if (!configPromise) configPromise = fetch('/api/auth/firebase/config').then(r => {
    if (!r.ok) throw new Error('Firebase sign-in is unavailable')
    return r.json()
  })
  return configPromise
}

export async function firebaseAuth() {
  if (!authPromise) authPromise = firebaseConfig().then(config => {
    if (!config.enabled) throw new Error('Social sign-in is not configured yet')
    const app = getApps()[0] || initializeApp(config.firebase)
    return getAuth(app)
  })
  return authPromise
}

export async function signInWithProvider(name) {
  const auth = await firebaseAuth()
  const provider = name === 'google' ? new GoogleAuthProvider() : name === 'facebook' ? new FacebookAuthProvider() : name === 'apple' ? new OAuthProvider('apple.com') : null
  if (!provider) throw new Error('Unsupported sign-in provider')
  if (name === 'facebook' || name === 'apple') provider.addScope('email')
  if (name === 'apple') provider.addScope('name')
  const result = await signInWithPopup(auth, provider)
  return result.user.getIdToken()
}

export async function firebaseToken() {
  const auth = await firebaseAuth()
  await auth.authStateReady()
  return auth.currentUser?.getIdToken() || null
}

export async function firebaseSignOut() {
  try { await signOut(await firebaseAuth()) } catch { /* Firebase may not be configured */ }
}
