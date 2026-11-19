import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Heart, Plus, Trash2, X } from 'lucide-react'
import { supabase } from './supabase'
import { useOverlay } from './overlay'

const START = new Date(2025, 9, 30)
const pad = (n) => String(n).padStart(2, '0')
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function Calendar({ me }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState(null)
  const [memories, setMemories] = useState([])
  const [text, setText] = useState('')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase
      .from('memories')
      .select('*')
      .order('created_at', { ascending: true })
    setMemories(data || [])
  }

  useEffect(() => {
    load()
    const ch = supabase
      .channel('memories')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memories' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  const byDate = {}
  memories.forEach((x) => (byDate[x.date] = [...(byDate[x.date] || []), x]))

  const closeSheet = () => {
    setSelected(null)
    setAdding(false)
    setText('')
  }
  useOverlay(!!selected, closeSheet)

  const selectDay = (k) => {
    setSelected(k)
    setText('')
    setAdding(!byDate[k]?.length)
  }

  const goToday = () => {
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    selectDay(key(today))
  }

  const minMonth = new Date(START.getFullYear(), START.getMonth(), 1)
  const maxMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const y = month.getFullYear()
  const m = month.getMonth()
  const cells = [
    ...Array(new Date(y, m, 1).getDay()).fill(null),
    ...Array.from({ length: new Date(y, m + 1, 0).getDate() }, (_, i) => new Date(y, m, i + 1)),
  ]

  const add = async () => {
    const content = text.trim()
    if (!content || saving) return
    setSaving(true)
    await supabase.from('memories').insert({ date: selected, author: me, content })
    setText('')
    setAdding(false)
    setSaving(false)
    load()
  }

  const remove = async (id) => {
    if (!confirm('Delete this memory?')) return
    await supabase.from('memories').delete().eq('id', id)
    load()
  }

  const dayMemories = selected ? byDate[selected] || [] : []

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <button
          disabled={month <= minMonth}
          onClick={() => setMonth(new Date(y, m - 1, 1))}
          className="p-2 disabled:opacity-20"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="text-center">
          <div className="font-semibold">
            {month.toLocaleDateString([], { month: 'long', year: 'numeric' })}
          </div>
          <button onClick={goToday} className="text-xs text-blue-500">
            Today
          </button>
        </div>
        <button
          disabled={month >= maxMonth}
          onClick={() => setMonth(new Date(y, m + 1, 1))}
          className="p-2 disabled:opacity-20"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DOW.map((d, i) => (
          <div key={i} className="text-xs text-neutral-500 py-1">
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />
          const k = key(d)
          const disabled = d < START || d > today
          const isToday = k === key(today)
          const has = byDate[k]?.length > 0
          return (
            <button
              key={k}
              disabled={disabled}
              onClick={() => selectDay(k)}
              className={`relative aspect-square flex items-center justify-center rounded-lg text-sm
                ${disabled ? 'text-neutral-700' : 'active:bg-neutral-800'}
                ${isToday ? 'ring-1 ring-blue-500' : ''}`}
            >
              {d.getDate()}
              {has && (
                <Heart size={9} className="absolute bottom-1 text-pink-500 fill-pink-500" />
              )}
            </button>
          )
        })}
      </div>

      {selected && (
        <div
          className="anim-fade fixed inset-0 z-40 bg-black/60 flex items-end md:items-center justify-center"
          onClick={closeSheet}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="anim-sheet w-full max-w-md bg-neutral-900 rounded-t-2xl md:rounded-2xl max-h-[85dvh] flex flex-col pb-[env(safe-area-inset-bottom)]"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
              <p className="font-semibold">
                {new Date(selected + 'T00:00:00').toLocaleDateString([], {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
              <button onClick={closeSheet} className="p-1 text-neutral-400">
                <X size={22} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {dayMemories.length === 0 && !adding && (
                <p className="text-sm text-neutral-500 text-center py-4">
                  No memory yet for this day
                </p>
              )}

              {dayMemories.map((x) => (
                <div key={x.id} className="bg-black rounded-xl p-3 flex justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm whitespace-pre-wrap break-words">{x.content}</p>
                    <p className="text-xs text-neutral-500 capitalize mt-1">{x.author}</p>
                  </div>
                  {x.author === me && (
                    <button onClick={() => remove(x.id)} className="text-neutral-500 shrink-0 p-1">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}

              {adding && (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    rows={4}
                    className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-base outline-none"
                    placeholder="Write a memory for this day"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={add}
                      disabled={!text.trim() || saving}
                      className="flex-1 bg-blue-600 rounded-xl py-3 text-sm font-medium disabled:opacity-40"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    {dayMemories.length > 0 && (
                      <button
                        onClick={() => {
                          setAdding(false)
                          setText('')
                        }}
                        className="px-5 border border-neutral-700 rounded-xl text-sm"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {!adding && (
              <div className="p-4 border-t border-neutral-800">
                <button
                  onClick={() => setAdding(true)}
                  className="w-full bg-blue-600 rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> Add memory
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
