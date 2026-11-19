import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import Login from './Login'
import Pin from './Pin'
import Shell from './Shell'

export default function App() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const [pinOk, setPinOk] = useState(sessionStorage.getItem('pin_ok') === '1')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (!s) {
        sessionStorage.removeItem('pin_ok')
        setPinOk(false)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) return null
  if (!session) return <Login />

  const needsPin = session.user.email.startsWith('sahil@')
  if (needsPin && !pinOk) return <Pin onVerified={() => setPinOk(true)} />

  return <Shell session={session} />
}