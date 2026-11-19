import { useEffect, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { supabase } from './supabase'
import { resize } from './image'
import { useOverlay } from './overlay'

const urlCache = new Map()
let itemsCache = []

const signAll = async (paths) => {
  const missing = [...new Set(paths)].filter((p) => !urlCache.has(p))
  if (!missing.length) return
  const { data } = await supabase.storage.from('pictures').createSignedUrls(missing, 86400)
  ;(data || []).forEach((s) => s.signedUrl && urlCache.set(s.path, s.signedUrl))
}

function Viewer({ p, me, onClose, onDelete }) {
  useOverlay(true, onClose)
  const [full, setFull] = useState(urlCache.get(p.path))

  useEffect(() => {
    if (full) return
    signAll([p.path]).then(() => setFull(urlCache.get(p.path)))
  }, [])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-between p-3">
        <button onClick={onClose} className="p-2 bg-white/10 rounded-full">
          <X size={22} />
        </button>
        {p.uploader === me && (
          <button onClick={() => onDelete(p)} className="p-2 bg-white/10 rounded-full">
            <Trash2 size={20} />
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <img
          src={full || urlCache.get(p.thumb_path || p.path)}
          className="max-w-full max-h-full object-contain"
        />
      </div>
      <div className="p-4">
        {p.caption && <p className="text-sm break-words">{p.caption}</p>}
        <p className="text-xs text-neutral-400 capitalize">
          {p.uploader} · {new Date(p.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  )
}

export default function Pictures({ me }) {
  const [items, setItems] = useState(itemsCache)
  const [loaded, setLoaded] = useState(itemsCache.length > 0)
  const [limit, setLimit] = useState(30)
  const [drafts, setDrafts] = useState([])
  const [uploading, setUploading] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [viewer, setViewer] = useState(null)

  const load = async () => {
    const { data } = await supabase
      .from('pictures')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    const rows = data || []
    await signAll(rows.map((p) => p.thumb_path || p.path))
    itemsCache = rows
    setItems(rows)
    setLoaded(true)
  }

  useEffect(() => {
    load()
    const ch = supabase
      .channel('pictures')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pictures' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [limit])

  const pick = (e) => {
    const files = Array.from(e.target.files)
    setDrafts((d) => [
      ...d,
      ...files.map((file) => ({ file, url: URL.createObjectURL(file), caption: '' })),
    ])
    e.target.value = ''
  }

  const setCaption = (i, caption) =>
    setDrafts((d) => d.map((x, idx) => (idx === i ? { ...x, caption } : x)))

  const upload = async () => {
    setUploading(true)
    for (const d of drafts) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const path = `${me}/${id}.jpg`
      const thumb_path = `${me}/thumbs/${id}.jpg`
      const [full, thumb] = await Promise.all([
        resize(d.file, 1600, 0.8),
        resize(d.file, 400, 0.7),
      ])
      const [a, b] = await Promise.all([
        supabase.storage.from('pictures').upload(path, full, { contentType: 'image/jpeg' }),
        supabase.storage.from('pictures').upload(thumb_path, thumb, { contentType: 'image/jpeg' }),
      ])
      if (!a.error && !b.error) {
        await supabase
          .from('pictures')
          .insert({ uploader: me, path, thumb_path, caption: d.caption.trim() || null })
      }
    }
    setDrafts([])
    setUploading(false)
    load()
  }

  const remove = async (p) => {
    if (!confirm('Delete this picture?')) return
    setViewer(null)
    await supabase.storage.from('pictures').remove([p.path, p.thumb_path].filter(Boolean))
    await supabase.from('pictures').delete().eq('id', p.id)
    load()
  }

  const missingThumbs = items.filter((p) => !p.thumb_path)

  const optimize = async () => {
    setOptimizing(true)
    for (const p of missingThumbs) {
      try {
        await signAll([p.path])
        const blob = await (await fetch(urlCache.get(p.path))).blob()
        const thumb = await resize(blob, 400, 0.7)
        const tpath = `${p.uploader}/thumbs/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
        const { error } = await supabase.storage
          .from('pictures')
          .upload(tpath, thumb, { contentType: 'image/jpeg' })
        if (!error) await supabase.from('pictures').update({ thumb_path: tpath }).eq('id', p.id)
      } catch {}
    }
    setOptimizing(false)
    load()
  }

  return (
    <div className="p-3 space-y-3">
      {drafts.length === 0 ? (
        <label className="flex items-center justify-center gap-2 bg-blue-600 rounded-xl py-3 text-sm font-medium cursor-pointer">
          <Plus size={18} /> Add pictures
          <input type="file" accept="image/*" multiple hidden onChange={pick} />
        </label>
      ) : (
        <div className="space-y-3">
          {drafts.map((d, i) => (
            <div key={i} className="flex gap-3 bg-neutral-900 rounded-xl p-2">
              <img src={d.url} className="w-20 h-20 object-cover rounded-lg" />
              <input
                className="flex-1 bg-transparent border-b border-neutral-700 text-base outline-none"
                placeholder="Caption"
                value={d.caption}
                onChange={(e) => setCaption(i, e.target.value)}
              />
            </div>
          ))}
          <div className="flex gap-2">
            <button
              onClick={upload}
              disabled={uploading}
              className="flex-1 bg-blue-600 rounded-xl py-3 text-sm disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : `Upload ${drafts.length}`}
            </button>
            <button
              onClick={() => setDrafts([])}
              disabled={uploading}
              className="px-4 border border-neutral-700 rounded-xl text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {drafts.length === 0 && missingThumbs.length > 0 && (
        <button
          onClick={optimize}
          disabled={optimizing}
          className="w-full border border-neutral-700 rounded-xl py-2 text-xs text-neutral-300 disabled:opacity-50"
        >
          {optimizing ? 'Optimizing...' : `Speed up ${missingThumbs.length} old pictures`}
        </button>
      )}

      {loaded && items.length === 0 && (
        <p className="text-neutral-500 text-sm text-center pt-6">No pictures yet</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        {items.map((p) => (
          <button
            key={p.id}
            onClick={() => setViewer(p)}
            className="text-left bg-neutral-900 rounded-xl overflow-hidden"
          >
            <div className="aspect-square bg-neutral-800">
              <img
                src={urlCache.get(p.thumb_path || p.path)}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            </div>
            {p.caption && <p className="text-xs p-2 truncate">{p.caption}</p>}
          </button>
        ))}
      </div>

      {items.length >= limit && (
        <button
          onClick={() => setLimit(limit + 30)}
          className="w-full border border-neutral-700 rounded-xl py-2 text-sm"
        >
          Load more
        </button>
      )}

      {viewer && <Viewer p={viewer} me={me} onClose={() => setViewer(null)} onDelete={remove} />}
    </div>
  )
}