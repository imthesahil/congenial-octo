import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Image as ImageIcon, Send, X } from 'lucide-react'
import { supabase } from './supabase'
import { resize } from './image'
import Avatar from './Avatar'
import Lightbox from './Lightbox'

const urlCache = new Map()

const dayLabel = (iso) => {
  const d = new Date(iso)
  const today = new Date()
  const yest = new Date()
  yest.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
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

export default function ChatPanel({
  me,
  other,
  otherStatus,
  subtitle,
  sendTyping,
  messages,
  addMessage,
  onBack,
}) {
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [sending, setSending] = useState(false)
  const [viewer, setViewer] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const first = useRef(true)

  const scrollDown = () => bottomRef.current?.scrollIntoView({ behavior: 'auto' })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: first.current ? 'auto' : 'smooth' })
    first.current = false
  }, [messages])

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

    setText('')
    clearFile()
    const { data } = await supabase
      .from('messages')
      .insert({ sender: me, content, image_path })
      .select()
      .single()
    if (data) addMessage(data)
    setSending(false)
  }

  return (
    <div className="flex flex-col flex-1 h-full min-w-0">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <button className="md:hidden p-1 -ml-1" onClick={onBack}>
          <ArrowLeft size={22} />
        </button>
        <Avatar name={other} />
        <div className="min-w-0">
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
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((m, i) => {
          const mine = m.sender === me
          const newDay =
            i === 0 ||
            new Date(messages[i - 1].created_at).toDateString() !==
              new Date(m.created_at).toDateString()
          return (
            <div key={m.id}>
              {newDay && (
                <div className="text-center my-3">
                  <span className="text-[11px] text-neutral-400 bg-neutral-900 rounded-full px-3 py-1">
                    {dayLabel(m.created_at)}
                  </span>
                </div>
              )}
              <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-[15px] ${
                    mine ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-white'
                  }`}
                >
                  {m.image_path && (
                    <ChatImage path={m.image_path} onOpen={setViewer} onLoaded={scrollDown} />
                  )}
                  {m.content && <div className="whitespace-pre-wrap break-words">{m.content}</div>}
                  <div className="text-[10px] mt-1 opacity-60 text-right">
                    {new Date(m.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </main>

      <div className="border-t border-neutral-800 pb-[env(safe-area-inset-bottom)]">
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
        <form onSubmit={send} className="p-3 flex gap-2 items-center">
          <label className="text-neutral-400 p-1 cursor-pointer">
            <ImageIcon size={24} />
            <input type="file" accept="image/*" hidden onChange={pickFile} />
          </label>
          <input
            ref={inputRef}
            enterKeyHint="send"
            className="flex-1 min-w-0 bg-neutral-900 border border-neutral-800 rounded-full px-4 py-2 text-base outline-none"
            placeholder="Type a message"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              if (e.target.value) sendTyping()
            }}
          />
          <button
            disabled={sending || (!text.trim() && !file)}
            className="bg-blue-600 rounded-full w-10 h-10 flex items-center justify-center disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </form>
      </div>

      {viewer && <Lightbox url={viewer} onClose={() => setViewer(null)} />}
    </div>
  )
}
