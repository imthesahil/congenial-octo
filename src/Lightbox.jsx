import { X } from 'lucide-react'
import { useOverlay } from './overlay'

export default function Lightbox({ url, onClose }) {
  useOverlay(true, onClose)
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center"
    >
      <button className="absolute top-4 right-4 p-2 bg-white/10 rounded-full">
        <X size={22} />
      </button>
      <img src={url} className="max-w-full max-h-full object-contain" />
    </div>
  )
}
