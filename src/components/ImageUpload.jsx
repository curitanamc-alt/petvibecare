import { useRef, useState } from 'react'
import { Button, cx } from './ui.jsx'

const MAX_INPUT_BYTES = 10 * 1024 * 1024 // accept up to 10 MB from the picker
const MAX_DIMENSION = 1024 // longest side after resize (px)
const JPEG_QUALITY = 0.82

// Upload / change / remove a photo. The picked file is auto-resized on a
// canvas (max 1024 px, JPEG) before being handed to onSave as a base64 data
// URL ('' means "remove") — so even a 10 MB phone photo becomes a ~150 KB
// JPEG instead of erroring out or bloating the database. Works identically in
// live and mock mode; the parent owns the API call + error handling.
export default function ImageUpload({ photoUrl, onSave, busy = false, round = true, size = 'xl' }) {
  const inputRef = useRef(null)
  const [error, setError] = useState('')

  const sizes = { sm: 'h-12 w-12', md: 'h-16 w-16', lg: 'h-20 w-20', xl: 'h-28 w-28' }

  const readAndResize = (file) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const scale = MAX_DIMENSION / Math.max(width, height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        // White background so transparent PNGs don't become black JPEGs.
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        onSave(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
      }
      img.onerror = () => setError("Couldn't read that image — try a JPG or PNG.")
      img.src = String(reader.result)
    }
    reader.onerror = () => setError('Could not read that file.')
    reader.readAsDataURL(file)
  }

  const pick = (e) => {
    const file = e.target.files?.[0]
    setError('')
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Please choose an image file (JPG/PNG).'); return }
    if (file.size > MAX_INPUT_BYTES) { setError('Image is too large — 10 MB max.'); return }
    readAndResize(file)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className={cx('grid shrink-0 place-items-center overflow-hidden bg-sage-100', round ? 'rounded-full' : 'rounded-2xl', sizes[size])}>
        {photoUrl ? (
          <img src={photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-2xl text-teal-300">🐾</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={pick} />
        <Button variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          {photoUrl ? 'Change photo' : 'Upload photo'}
        </Button>
        {photoUrl && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => onSave('')}>Remove</Button>
        )}
      </div>
      {busy && <p className="text-xs text-charcoal-400">Saving…</p>}
      {error && <p className="max-w-[12rem] text-center text-xs font-medium text-red-500">{error}</p>}
    </div>
  )
}
