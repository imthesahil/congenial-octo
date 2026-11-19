import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from './supabase'
import Lightbox from './Lightbox'

const resize = (file, max = 1600) =>
  new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    }
    img.src = URL.createObjectURL(file)
  })

export default function Pictures({ me }) {
  const [items, setItems] = useState([])
  const [drafts, setDrafts] = useState([])
  const [uploading, setUploading] = useState(false)
  const [viewer, setViewer] = useState(null)

  const load = async () => {
    const { data } = await supabase
      .from('pictures')
      .select('*')
      .order('created_at', { ascending: false })
    if (!data?.length) return setItems([])
    const { data: signed } = await supabase.storage
      .from('pictures')
      .createSignedUrls(data.map((p) => p.path), 3600)
    const urls = {}
    ;(signed || []).forEach((s) => (urls[s.path] = s.signedUrl))
    setItems(data.map((p) => ({ ...p, url: urls[p.path] })))
  }

  useEffect(() => {
    load()
    const ch = supabase
      .channel('pictures')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pictures' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

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
      const blob = await resize(d.file)
      const path = `${me}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
      const { error } = await supabase.storage
        .from('pictures')
        .upload(path, blob, { contentType: 'image/jpeg' })
      if (!error) {
        await supabase
          .from('pictures')
          .insert({ uploader: me, path, caption: d.caption.trim() || null })
      }
    }
    setDrafts([])
    setUploading(false)
    load()
  }

  const remove = async (p) => {
    if (!confirm('Delete this picture?')) return
    await supabase.storage.from('pictures').remove([p.path])
    await supabase.from('pictures').delete().eq('id', p.id)
    load()
  }

  return (
    <div className="p-3 space-y-4">
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

      {items.length === 0 && (
        <p className="text-neutral-500 text-sm text-center pt-6">No pictures yet</p>
      )}

      {items.map((p) => (
        <div key={p.id} className="bg-neutral-900 rounded-xl overflow-hidden">
          <img src={p.url} onClick={() => setViewer(p.url)} className="w-full object-cover" loading="lazy" />
          <div className="p-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              {p.caption && <p className="text-sm break-words">{p.caption}</p>}
              <p className="text-xs text-neutral-500 capitalize">
                {p.uploader} · {new Date(p.created_at).toLocaleDateString()}
              </p>
            </div>
            {p.uploader === me && (
              <button onClick={() => remove(p)} className="text-neutral-500">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      ))}
      {viewer && <Lightbox url={viewer} onClose={() => setViewer(null)} />}
    </div>
  )
}