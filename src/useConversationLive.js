import { useEffect, useRef, useState } from 'react'
import { accessToken, BASE } from './api.js'

export default function useConversationLive(scope, id, onChange, enabled = true) {
  const callback = useRef(onChange)
  const [status, setStatus] = useState('connecting')
  useEffect(() => { callback.current = onChange }, [onChange])

  useEffect(() => {
    if (!enabled) return
    let stopped = false
    let retry
    let attempt = 0
    const controller = new AbortController()
    const fallback = window.setInterval(() => callback.current(), 10000)

    async function connect() {
      if (stopped) return
      const connection = new AbortController()
      controller.signal.addEventListener('abort', () => connection.abort(), { once: true })
      try {
        const bearer = await accessToken()
        if (!bearer) throw new Error('Session unavailable')
        const query = new URLSearchParams({ scope, id: id || '' })
        const response = await fetch(`${BASE}/conversations/live?${query}`, {
          headers: { Authorization: `Bearer ${bearer}`, Accept: 'text/event-stream' },
          cache: 'no-store', signal: connection.signal,
        })
        if (!response.ok || !response.body) throw new Error('Live connection unavailable')
        if (!stopped) { setStatus('live'); attempt = 0; callback.current() }
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (!stopped) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split(/\r?\n\r?\n/)
          buffer = parts.pop()
          for (const part of parts) if (part.includes('event: changed')) callback.current()
        }
      } catch (error) {
        if (stopped || error.name === 'AbortError') return
      }
      if (!stopped) {
        setStatus('reconnecting')
        retry = window.setTimeout(connect, Math.min(1000 * 2 ** attempt++, 10000))
      }
    }
    setStatus('connecting')
    connect()
    return () => { stopped = true; controller.abort(); window.clearTimeout(retry); window.clearInterval(fallback) }
  }, [scope, id, enabled])
  return status
}
