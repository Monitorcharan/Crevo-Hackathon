import { useEffect, useState } from 'react'
import { SiGoogle, SiApple, SiFacebook } from 'react-icons/si'
import { useNavigate } from 'react-router-dom'
import { api, setAuthMode, setToken } from './api.js'
import { firebaseConfig, firebaseSignOut, signInWithProvider } from './firebaseAuth.js'

const providers = [{ key: 'google', label: 'Google', Icon: SiGoogle }, { key: 'apple', label: 'Apple', Icon: SiApple }, { key: 'facebook', label: 'Facebook', Icon: SiFacebook }]

export default function SocialSignIn({ role, connect = false, onAuth }) {
  const [enabled, setEnabled] = useState([]), [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const navigate = useNavigate()
  useEffect(() => { firebaseConfig().then(c => setEnabled(c.providers || [])).catch(() => {}) }, [])
  if (!enabled.length) return null
  async function select(name) {
    setBusy(name); setError(''); setNotice('')
    try {
      const idToken = await signInWithProvider(name)
      if (connect) {
        await api('/auth/firebase/link', { method: 'POST', body: { id_token: idToken } })
        await firebaseSignOut()
        setNotice(`${name[0].toUpperCase() + name.slice(1)} connected. You can use it next time you sign in.`)
      } else {
        const result = await api('/auth/firebase', { method: 'POST', body: { id_token: idToken, role } })
        setToken(null); setAuthMode('firebase'); onAuth(result); navigate('/dashboard')
      }
    } catch (cause) {
      await firebaseSignOut()
      setError(cause.code === 'auth/popup-closed-by-user' ? 'Sign-in window closed.' : cause.message || 'Could not sign in')
    } finally { setBusy('') }
  }
  return <div className="social-signin"><span className="social-divider">{connect ? 'CONNECT A SIGN-IN METHOD' : 'OR CONTINUE WITH'}</span><div className="social-signin-buttons">{providers.filter(p => enabled.includes(p.key)).map(({ key, label, Icon }) => <button type="button" className="social-signin-button" key={key} onClick={() => select(key)} disabled={Boolean(busy)}><Icon aria-hidden="true"/> {connect ? `Connect ${label}` : `Continue with ${label}`}</button>)}</div>{connect && <p className="social-signin-hint">Connect an account while signed in, then use its button on the login page.</p>}{error && <div className="alert" role="alert">{error}</div>}{notice && <div className="notice">{notice}</div>}</div>
}
