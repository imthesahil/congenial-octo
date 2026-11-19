import { useState } from 'react'
import { supabase } from './supabase'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({
      email: `${username.trim().toLowerCase()}@chat.app`,
      password,
    })
    if (error) setError('Authentication failed. This attempt has been logged.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-200 flex flex-col">
      <div className="bg-slate-800 text-slate-200 px-6 py-3 flex items-center gap-3 text-sm">
        <span className="font-bold tracking-wide">SecureGate</span>
        <span className="text-slate-400">Network Firewall Appliance · Management Console</span>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <form
          onSubmit={handleLogin}
          className="bg-white w-full max-w-sm border border-slate-300 shadow-md"
        >
          <div className="bg-slate-700 text-white px-5 py-3 text-sm font-semibold">
            Administrator Authentication
          </div>

          <div className="p-5 space-y-4">
            <div className="bg-amber-50 border border-amber-400 text-amber-800 text-xs p-3 leading-relaxed">
              <b>WARNING:</b> Authorized personnel only. Access is permitted from the
              internal office network only. Only <b>1 login attempt</b> is allowed per
              session. All access is monitored and logged.
            </div>

            <div>
              <label className="text-xs text-slate-600">Username</label>
              <input
                className="w-full border border-slate-400 p-2 text-sm"
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-slate-600">Password</label>
              <input
                className="w-full border border-slate-400 p-2 text-sm"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-red-600 text-xs">{error}</p>}

            <button
              disabled={loading}
              className="w-full bg-slate-700 hover:bg-slate-800 text-white text-sm p-2 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Log In'}
            </button>
          </div>

          <div className="border-t border-slate-200 px-5 py-2 text-[10px] text-slate-500">
            SecureGate OS v4.2.1 · Unauthorized access is prohibited
          </div>
        </form>
      </div>
    </div>
  )
}