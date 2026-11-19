import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Camera,
  Copy,
  CornerUpLeft,
  Image as ImageIcon,
  MoreVertical,
  Pin,
  PinOff,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import { supabase } from './supabase'
import { resize } from './image'
import { useOverlay } from './overlay'
import Avatar from './Avatar'
import Lightbox from './Lightbox'

const urlCache = new Map()
const URL_RE = /((?:https?:\/\/|www\.)[^\s]+)/gi

const snippet = (m) => m.content || '\u{1F4F7} Photo'

const dayLabel = (iso) => {
  const d = new Date(iso)
  const today = new Date()
  const yest = new Date()
  yest.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
}

function Linkified({ text }) {
  return text.split(URL_RE).map((part, i) => {
    if (i % 2 === 0) return part
    const trail = part.match(/[.,!?)\]]+$/)?.[0] || ''
    const clean = trail ? part.slice(0, -trail.length) : part
    const href = clean.startsWith('http') ? clean : `https://${clean}`
    return (
      <span key={i}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 font-medium break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {clean}
        </a>
        {trail}
      </span>
    )
  })
}

function ChatImage({ path, onOpen, onLoaded }) {
  const [url, setUrl] = useState(urlCache.get(path))

  useEffect(() => {
    if (url) return
    supabase.storage
      .from('chat-media')
      .createSignedUrl(path, 86400)
      .then(({ data }) => {
        if (data?.signedUrl) {
          urlCache.set(path, data.signedUrl)
          setUrl(data.signedUrl)
        }
      })
  }, [path])

  if (!url) return <div className="w-48 h-48 bg-neutral-700/40 rounded-lg animate-pulse" />
  return (
    <img
      src={url}
      onClick={() => onOpen(url)}
      onLoad={onLoaded}
      className="rounded-lg max-h-72 max-w-full mb-1"
    />
  )
}

function SwipeRow({ onReply, onLongPress, children }) {
  const start = useRef(null)
  const timer = useRef(null)
  const [dx, setDx] = useState(0)

  const cancelTimer = () => {
    clearTimeout(timer.current)
    timer.current = null
  }

  const onStart = (e) => {
    const t = e.touches[0]
    start.current = { x: t.clientX, y: t.clientY }
    cancelTimer()
    timer.current = setTimeout(() => {
      navigator.vibrate?.(20)
      start.current = null
      onLongPress()
    }, 450)
  }

  const onMove = (e) => {
    const s = start.current
    if (!s) return
    const t = e.touches[0]
    const mx = t.clientX - s.x
    const my = t.clientY - s.y
    if (Math.abs(mx) > 8 || Math.abs(my) > 8) cancelTimer()
    if (Math.abs(my) > 12 && Math.abs(my) > Math.abs(mx)) {
      start.current = null
      setDx(0)
      return
    }
    setDx(mx > 0 ? Math.min(mx, 72) : 0)
  }

  const onEnd = () => {
    cancelTimer()
    if (dx > 56) {
      navigator.vibrate?.(15)
      onReply()
    }
    setDx(0)
    start.current = null
  }

  return (
    <div
      className="relative"
      style={{ touchAction: 'pan-y', WebkitTouchCallout: 'none' }}
      onTouchStart={onStart}
      onTouchMove={onMove}
      onTouchEnd={onEnd}
      onTouchCancel={onEnd}
      onContextMenu={(e) => {
        e.preventDefault()
        onLongPress()
      }}
    >
      <div
        className="absolute left-2 top-1/2 -translate-y-1/2 text-pink-400"
        style={{ opacity: Math.min(dx / 56, 1) }}
      >
        <CornerUpLeft size={20} />
      </div>
      <div
        style={{
          transform: `translateX(${dx}px)`,
          transition: dx ? 'none' : 'transform .2s',
        }}
      >
        {children}
      </div>
    </div>
  )
}

const MessageRow = memo(function MessageRow({
  m,
  orig,
  mine,
  me,
  newDay,
  isNew,
  onReply,
  onMenu,
  onJump,
  onOpen,
  onLoaded,
}) {
  const replyBtn = (
    <button
      type="button"
      onClick={() => onReply(m)}
      className="hidden md:flex invisible group-hover:visible p-1 text-neutral-400"
    >
      <CornerUpLeft size={16} />
    </button>
  )

  return (
    <div id={`msg-${m.id}`} className={`rounded-xl ${isNew ? 'anim-msg' : ''}`}>
      {newDay && (
        <div className="text-center my-3">
          <span className="text-[11px] text-neutral-400 bg-neutral-900 rounded-full px-3 py-1">
            {dayLabel(m.created_at)}
          </span>
        </div>
      )}
      <SwipeRow onReply={() => onReply(m)} onLongPress={() => onMenu(m)}>
        <div className={`group flex items-center gap-1 ${mine ? 'justify-end' : 'justify-start'}`}>
          {mine && replyBtn}
          <div
            className={`max-w-[80%] px-3 py-2 rounded-2xl text-[15px] select-none md:select-text ${
              mine ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-white'
            }`}
          >
            {orig && (
              <button
                type="button"
                onClick={() => onJump(orig.id)}
                className="block w-full text-left mb-1 rounded-lg bg-black/25 border-l-4 border-pink-300 px-2 py-1"
              >
                <div className="text-[11px] font-semibold capitalize text-pink-200">
                  {orig.sender === me ? 'You' : orig.sender}
                </div>
                <div className="text-xs opacity-80 line-clamp-2 break-words">{snippet(orig)}</div>
              </button>
            )}
            {m.image_path && <ChatImage path={m.image_path} onOpen={onOpen} onLoaded={onLoaded} />}
            {m.content && (
              <div className="whitespace-pre-wrap break-words">
                <Linkified text={m.content} />
              </div>
            )}
            <div className="text-[10px] mt-1 opacity-60 text-right flex items-center justify-end gap-1">
              {m.pinned && <Pin size={10} />}
              {new Date(m.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
          {!mine && replyBtn}
        </div>
      </SwipeRow>
    </div>
  )
})

function ActionSheet({ m, onClose, onReply, onPin, onCopy }) {
  useOverlay(true, onClose)
  const items = [
    { label: 'Reply', Icon: CornerUpLeft, run: onReply },
    { label: m.pinned ? 'Unpin' : 'Pin', Icon: m.pinned ? PinOff : Pin, run: onPin },
    ...(m.content ? [{ label: 'Copy', Icon: Copy, run: onCopy }] : []),
  ]
  return (
    <div className="anim-fade fixed inset-0 z-50 bg-black/50 flex items-end" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="anim-sheet w-full bg-neutral-900 rounded-t-2xl p-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
      >
        <div className="mx-auto w-10 h-1 rounded-full bg-neutral-700 my-2" />
        <div className="px-4 pb-2 text-xs text-neutral-500 truncate">{snippet(m)}</div>
        {items.map(({ label, Icon, run }) => (
          <button
            key={label}
            onClick={() => {
              run()
              onClose()
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl active:bg-neutral-800"
          >
            <Icon size={20} /> {label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Composer({ me, replyTo, clearReply, inputRef, sendTyping, addMessage }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [sending, setSending] = useState(false)

  const pickFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    e.target.value = ''
  }

  const clearFile = () => {
    setFile(null)
    setPreview(null)
  }

  const send = async (e) => {
    e.preventDefault()
    const content = text.trim()
    if ((!content && !file) || sending) return
    inputRef.current?.focus()
    setSending(true)

    let image_path = null
    if (file) {
      const blob = await resize(file)
      const path = `${me}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
      const { error } = await supabase.storage
        .from('chat-media')
        .upload(path, blob, { contentType: 'image/jpeg' })
      if (error) {
        setSending(false)
        return
      }
      image_path = path
    }

    const reply_to = replyTo?.id ?? null
    setText('')
    clearReply()
    clearFile()
    const { data } = await supabase
      .from('messages')
      .insert({ sender: me, content, image_path, reply_to })
      .select()
      .single()
    if (data) addMessage(data)
    setSending(false)
  }

  return (
    <div className="border-t border-neutral-800 pb-[env(safe-area-inset-bottom)]">
      {replyTo && (
        <div className="anim-fade flex items-center gap-2 px-3 pt-3">
          <div className="flex-1 min-w-0 bg-neutral-900 border-l-4 border-pink-400 rounded-lg px-3 py-1.5">
            <div className="text-xs font-semibold capitalize text-pink-400">
              Replying to {replyTo.sender === me ? 'yourself' : replyTo.sender}
            </div>
            <div className="text-xs text-neutral-300 truncate">{snippet(replyTo)}</div>
          </div>
          <button type="button" onClick={clearReply} className="p-1 text-neutral-400">
            <X size={18} />
          </button>
        </div>
      )}

      {preview && (
        <div className="relative w-fit p-3 pb-0">
          <img src={preview} className="h-20 rounded-lg" />
          <button
            type="button"
            onClick={clearFile}
            className="absolute top-4 right-1 bg-black/70 rounded-full p-1"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <form onSubmit={send} className="p-3 flex gap-1 items-center">
        <label className="text-neutral-400 p-1.5 cursor-pointer">
          <ImageIcon size={24} />
          <input type="file" accept="image/*" hidden onChange={pickFile} />
        </label>
        <label className="text-neutral-400 p-1.5 cursor-pointer">
          <Camera size={24} />
          <input type="file" accept="image/*" capture="environment" hidden onChange={pickFile} />
        </label>
        <input
          ref={inputRef}
          enterKeyHint="send"
          className="flex-1 min-w-0 ml-1 bg-neutral-900 border border-neutral-800 rounded-full px-4 py-2 text-base outline-none"
          placeholder="Type a message"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (e.target.value) sendTyping()
          }}
        />
        <button
          disabled={sending || (!text.trim() && !file)}
          className="bg-blue-600 rounded-full w-10 h-10 ml-1 flex items-center justify-center disabled:opacity-40"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}

export default function ChatPanel({
  me,
  other,
  otherStatus,
  subtitle,
  sendTyping,
  messages,
  setMessages,
  addMessage,
  onBack,
}) {
  const [viewer, setViewer] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [sheet, setSheet] = useState(null)
  const [menu, setMenu] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const first = useRef(true)
  const seen = useRef(null)

  useOverlay(menu, () => setMenu(false))

  const byId = useMemo(() => {
    const o = {}
    messages.forEach((m) => (o[m.id] = m))
    return o
  }, [messages])

  const pinned = messages.find((m) => m.pinned)

  const scrollDown = useCallback(
    () => bottomRef.current?.scrollIntoView({ behavior: 'auto' }),
    []
  )

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: first.current ? 'auto' : 'smooth' })
    first.current = false
    seen.current = new Set(messages.map((m) => m.id))
  }, [messages])

  const startReply = useCallback((m) => {
    setReplyTo(m)
    inputRef.current?.focus()
  }, [])

  const jumpTo = useCallback((id) => {
    const el = document.getElementById(`msg-${id}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.animate(
      [{ backgroundColor: 'rgba(255,92,138,0.25)' }, { backgroundColor: 'transparent' }],
      { duration: 1400 }
    )
  }, [])

  const togglePin = async (m) => {
    setMessages((prev) =>
      prev.map((x) => ({ ...x, pinned: m.pinned ? (x.id === m.id ? false : x.pinned) : x.id === m.id }))
    )
    if (m.pinned) {
      await supabase.from('messages').update({ pinned: false }).eq('id', m.id)
    } else {
      await supabase.from('messages').update({ pinned: false }).eq('pinned', true)
      await supabase.from('messages').update({ pinned: true }).eq('id', m.id)
    }
  }

  const clearChat = async () => {
    setMenu(false)
    if (!confirm('Clear this chat for both of you? This cannot be undone.')) return
    const paths = messages.map((m) => m.image_path).filter(Boolean)
    if (paths.length) await supabase.storage.from('chat-media').remove(paths)
    await supabase.from('messages').delete().gt('id', 0)
    setMessages([])
  }

  return (
    <div className="anim-slide flex flex-col flex-1 h-full min-w-0">
      <header className="relative z-20 flex items-center gap-3 px-4 py-3 border-b border-neutral-800 bg-black">
        <button className="md:hidden p-1 -ml-1" onClick={onBack}>
          <ArrowLeft size={22} />
        </button>
        <Avatar name={other} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold capitalize">
            {other}
            {otherStatus && <span className="ml-1">{otherStatus.emoji}</span>}
          </div>
          {subtitle && (
            <div
              className={`text-xs ${
                subtitle === 'typing...' || subtitle === 'online'
                  ? 'text-blue-500'
                  : 'text-neutral-500'
              }`}
            >
              {subtitle}
            </div>
          )}
        </div>

        <div className="relative">
          <button onClick={() => setMenu(!menu)} className="p-2 -mr-2 text-neutral-400">
            <MoreVertical size={20} />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="anim-pop absolute right-0 top-full mt-1 z-20 w-44 bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-lg">
                <button
                  onClick={clearChat}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left text-red-500"
                >
                  <Trash2 size={16} /> Clear chat
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {pinned && (
        <div
          onClick={() => jumpTo(pinned.id)}
          className="anim-fade flex items-center gap-2 px-4 py-2 bg-neutral-900 border-b border-neutral-800 cursor-pointer"
        >
          <Pin size={14} className="text-pink-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold text-pink-500">Pinned message</div>
            <div className="text-xs truncate">{snippet(pinned)}</div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              togglePin(pinned)
            }}
            className="p-1 text-neutral-400"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <main className="chat-bg flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((m, i) => (
          <MessageRow
            key={m.id}
            m={m}
            orig={m.reply_to ? byId[m.reply_to] : null}
            mine={m.sender === me}
            me={me}
            newDay={
              i === 0 ||
              new Date(messages[i - 1].created_at).toDateString() !==
                new Date(m.created_at).toDateString()
            }
            isNew={seen.current ? !seen.current.has(m.id) : false}
            onReply={startReply}
            onMenu={setSheet}
            onJump={jumpTo}
            onOpen={setViewer}
            onLoaded={scrollDown}
          />
        ))}
        <div ref={bottomRef} />
      </main>

      <Composer
        me={me}
        replyTo={replyTo}
        clearReply={() => setReplyTo(null)}
        inputRef={inputRef}
        sendTyping={sendTyping}
        addMessage={addMessage}
      />

      {sheet && (
        <ActionSheet
          m={sheet}
          onClose={() => setSheet(null)}
          onReply={() => startReply(sheet)}
          onPin={() => togglePin(sheet)}
          onCopy={() => navigator.clipboard?.writeText(sheet.content)}
        />
      )}

      {viewer && <Lightbox url={viewer} onClose={() => setViewer(null)} />}
    </div>
  )
}

