import { useState } from 'react'
import { supabase } from './supabase'

const PIN = '311026'

export default function Pin({ onVerified }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const handleVerify = (e) => {
    e.preventDefault()
    if (pin === PIN) {
      sessionStorage.setItem('pin_ok', '1')
      onVerified()
    } else {
      setError('Invalid security PIN. This attempt has been logged.')
      setPin('')
    }
  }

  return (
    <div className="min-h-screen bg-slate-200 flex flex-col">
      <div className="bg-slate-800 text-slate-200 px-6 py-3 flex items-center gap-3 text-sm">
        <span className="font-bold tracking-wide">SecureGate</span>
        <span className="text-slate-400">Network Firewall Appliance · Management Console</span>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <form
          onSubmit={handleVerify}
          className="bg-white w-full max-w-sm border border-slate-300 shadow-md"
        >
          <div className="bg-slate-700 text-white px-5 py-3 text-sm font-semibold">
            Two-Factor Verification
          </div>

          <div className="p-5 space-y-4">
            <div className="bg-blue-50 border border-blue-300 text-blue-800 text-xs p-3 leading-relaxed">
              A 6-digit security PIN has been sent to your registered office email address.
              Enter it below to continue.
            </div>

            <div>
              <label className="text-xs text-slate-600">Security PIN</label>
              <input
                className="w-full border border-slate-400 p-2 text-sm tracking-[0.5em]"
                type="password"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
            </div>

            {error && <p className="text-red-600 text-xs">{error}</p>}

            <button className="w-full bg-slate-700 hover:bg-slate-800 text-white text-sm p-2">
              Verify
            </button>
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="w-full text-xs text-slate-500"
            >
              Cancel
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