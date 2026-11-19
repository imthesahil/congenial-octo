import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Image, CalendarDays, UserCircle, Heart, Sun, Moon } from 'lucide-react'
import { supabase } from './supabase'
import Avatar from './Avatar'
import ChatPanel from './ChatPanel'
import Pictures from './Pictures'
import Calendar from './Calendar'
import { useOverlay } from './overlay'

const TABS = [
  { id: 'chats', label: 'Chats', Icon: MessageSquare },
  { id: 'pictures', label: 'Pictures', Icon: Image },
  { id: 'calendar', label: 'Calendar', Icon: CalendarDays },
  { id: 'account', label: 'Account', Icon: UserCircle },
]

const STATUSES = {
  missing: { emoji: '\u{1F97A}', label: 'Missing you' },
  love: { emoji: '\u2764\uFE0F', label: 'Love' },
  sad: { emoji: '\u{1F622}', label: 'Sad' },
  happy: { emoji: '\u{1F60A}', label: 'Happy' },
  angry: { emoji: '\u{1F621}', label: 'Angry' },
}
const DAY = 24 * 60 * 60 * 1000

const fmtSeen = (iso) => {
  const d = new Date(iso)
  const t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toDateString() === new Date().toDateString()
    ? `today at ${t}`
    : `${d.toLocaleDateString([], { day: '2-digit', month: '2-digit' })} at ${t}`
}

export default function Shell({ session }) {
  const me = session.user.email.split('@')[0]
  const other = me === 'manjula' ? 'sahil' : 'manjula'
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark')

  useEffect(() => {
    localStorage.setItem('theme', theme)
    document.documentElement.dataset.theme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', theme === 'light' ? '#fff6f9' : '#15070d')
    return () => {
      delete document.documentElement.dataset.theme
      meta?.setAttribute('content', '#15070d')
    }
  }, [theme])

  const [tab, setTab] = useState('chats')
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [statuses, setStatuses] = useState({})
  const [menu, setMenu] = useState(false)
  const [online, setOnline] = useState(false)
  const [typing, setTyping] = useState(false)
  const [lastSeen, setLastSeen] = useState(null)
  const roomRef = useRef(null)
  const lastTypingSent = useRef(0)

  useOverlay(open, () => setOpen(false))
  useOverlay(menu, () => setMenu(false))
  useOverlay(tab !== 'chats', () => setTab('chats'))

  const addMessage = (msg) =>
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))

  const loadStatuses = async () => {
    const { data } = await supabase.from('statuses').select('*')
    const map = {}
    ;(data || []).forEach((r) => (map[r.username] = r))
    setStatuses(map)
  }

  useEffect(() => {
    supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data }) => setMessages(data || []))

    const msgChannel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => addMessage(payload.new)
      )
      .subscribe()

    loadStatuses()
    const statusChannel = supabase
      .channel('statuses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'statuses' }, loadStatuses)
      .subscribe()

    return () => {
      supabase.removeChannel(msgChannel)
      supabase.removeChannel(statusChannel)
    }
  }, [])

  useEffect(() => {
    const loadLastSeen = async () => {
      const { data } = await supabase
        .from('last_seen')
        .select('seen_at')
        .eq('username', other)
        .maybeSingle()
      setLastSeen(data?.seen_at || null)
    }
    const beat = () =>
      supabase.from('last_seen').upsert({ username: me, seen_at: new Date().toISOString() })

    beat()
    loadLastSeen()
    const timer = setInterval(() => {
      beat()
      loadLastSeen()
    }, 30000)
    document.addEventListener('visibilitychange', beat)

    let typingTimer
    const room = supabase.channel('room', { config: { presence: { key: me } } })
    room
      .on('presence', { event: 'sync' }, () => {
        setOnline(!!room.presenceState()[other])
        loadLastSeen()
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.user !== other) return
        setTyping(true)
        clearTimeout(typingTimer)
        typingTimer = setTimeout(() => setTyping(false), 2500)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await room.track({ user: me })
      })
    roomRef.current = room

    return () => {
      clearInterval(timer)
      clearTimeout(typingTimer)
      document.removeEventListener('visibilitychange', beat)
      supabase.removeChannel(room)
    }
  }, [])

  const sendTyping = () => {
    if (Date.now() - lastTypingSent.current < 2000) return
    lastTypingSent.current = Date.now()
    roomRef.current?.send({ type: 'broadcast', event: 'typing', payload: { user: me } })
  }

  const getStatus = (u) => {
    const s = statuses[u]
    if (!s || Date.now() - new Date(s.set_at).getTime() > DAY) return null
    return STATUSES[s.status] || null
  }

  const setStatus = async (key) => {
    setMenu(false)
    await supabase
      .from('statuses')
      .upsert({ username: me, status: key, set_at: new Date().toISOString() })
    loadStatuses()
  }

  const clearStatus = async () => {
    setMenu(false)
    await supabase.from('statuses').delete().eq('username', me)
    loadStatuses()
  }

  const subtitle = typing
    ? 'typing...'
    : online
    ? 'online'
    : lastSeen
    ? `last seen ${fmtSeen(lastSeen)}`
    : ''
  const myStatus = getStatus(me)
  const otherStatus = getStatus(other)
  const last = messages[messages.length - 1]

  return (
    <div className="h-dvh flex bg-black text-white pt-[env(safe-area-inset-top)]">
      <aside
        className={`${open ? 'hidden' : 'flex'} md:flex w-full md:w-[340px] flex-col border-r border-neutral-800`}
      >
        <div className="relative px-4 py-4 flex items-center justify-between border-b border-neutral-800">
          <h1 className="font-love text-3xl flex items-center gap-2">
            OurWorld <Heart size={18} className="text-pink-500 fill-pink-500" />
          </h1>
          <button
            onClick={() => setMenu(!menu)}
            className="text-xs border border-neutral-700 rounded-full px-3 py-1 text-neutral-400"
          >
            {myStatus ? `${myStatus.emoji} ${myStatus.label}` : 'Set status'}
          </button>

          {menu && <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />}
          {menu && (
            <div className="absolute right-4 top-14 z-20 w-44 bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
              {Object.entries(STATUSES).map(([k, s]) => (
                <button
                  key={k}
                  onClick={() => setStatus(k)}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-neutral-800"
                >
                  {s.emoji} {s.label}
                </button>
              ))}
              {myStatus && (
                <button
                  onClick={clearStatus}
                  className="w-full text-left px-4 py-3 text-sm text-neutral-400 border-t border-neutral-800"
                >
                  Clear status
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === 'chats' && (
            <>

              {(
                <button
                  onClick={() => setOpen(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-900 text-left"
                >
                  <Avatar name={other} size="w-12 h-12" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between">
                      <span className="font-semibold capitalize">
                        {other}
                        {otherStatus && <span className="ml-1">{otherStatus.emoji}</span>}
                      </span>
                      {last && (
                        <span className="text-xs text-neutral-500">
                          {new Date(last.created_at).toLocaleDateString([], {
                            day: '2-digit',
                            month: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                    <p className={`text-xs truncate ${typing ? 'text-blue-500' : 'text-neutral-500'}`}>
                      {typing
                        ? 'typing...'
                        : last
                        ? `${last.sender === me ? 'You: ' : ''}${last.content || '\u{1F4F7} Photo'}`
                        : 'Say hi'}
                    </p>
                  </div>
                </button>
              )}
            </>
          )}

          {tab === 'pictures' && <Pictures me={me} />}
          {tab === 'calendar' && <Calendar me={me} />}
          {tab === 'account' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Avatar name={me} size="w-12 h-12" />
                <span className="font-semibold capitalize">{me}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Theme</span>
                <div className="flex bg-neutral-900 rounded-full p-1">
                  {[
                    ['dark', Moon],
                    ['light', Sun],
                  ].map(([t, Icon]) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`px-3 py-1 rounded-full text-sm capitalize flex items-center gap-1 ${
                        theme === t ? 'bg-blue-600' : 'text-neutral-400'
                      }`}
                    >
                      <Icon size={14} /> {t}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => supabase.auth.signOut()}
                className="w-full border border-neutral-700 rounded-lg py-2 text-sm"
              >
                Logout
              </button>
            </div>
          )}
        </div>

        <nav className="flex border-t border-neutral-800 pb-[env(safe-area-inset-bottom)]">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 py-2 flex flex-col items-center gap-1 text-[11px] ${
                tab === id ? 'text-blue-500' : 'text-neutral-500'
              }`}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <section className={`${open ? 'flex' : 'hidden'} md:flex flex-1 min-w-0`}>
        {open ? (
          <ChatPanel
            me={me}
            other={other}
            otherStatus={otherStatus}
            subtitle={subtitle}
            sendTyping={sendTyping}
            messages={messages}
            addMessage={addMessage}
            onBack={() => setOpen(false)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <Heart size={64} className="text-pink-500/40 fill-pink-500/20 mb-4" />
            <h2 className="font-love text-3xl">Welcome to OurWorld</h2>
            <p className="text-sm text-neutral-500 mt-1">Our little world, just us</p>
          </div>
        )}
      </section>
    </div>
  )
}