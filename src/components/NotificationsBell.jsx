import { useEffect, useRef, useState } from 'react'
import { cx } from './ui.jsx'

const TYPE_ICON = {
  confirmation: '✅',
  booking_received: '🕐',
  rebooking: '🔁',
  reschedule: '📅',
  reminder: '⏰',
}

// Fallback titles for rows created before the `subject` column existed.
const TYPE_LABEL = {
  confirmation: 'Booking confirmed',
  booking_received: 'Booking received',
  rebooking: 'Rebooking',
  reschedule: 'Reschedule',
  reminder: 'Reminder',
}

function timeAgo(isoStr) {
  if (!isoStr) return ''
  const then = new Date(isoStr).getTime()
  if (Number.isNaN(then)) return ''
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(isoStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

// Dropdown notifications bell used in the admin and client-portal headers.
// `fetchFn` must resolve to { notifications, unread } (see /api/notifications
// and /api/admin/notifications); `markReadFn` marks everything as read.
export default function NotificationsBell({ fetchFn, markReadFn, emptyText = 'No notifications yet' }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState(null)
  const [unread, setUnread] = useState(0)
  const ref = useRef(null)

  const load = () => {
    fetchFn()
      .then((d) => {
        const list = d?.notifications ?? d ?? []
        setItems(list)
        setUnread(d?.unread ?? list.filter((n) => !n.read_at).length)
      })
      .catch(() => {})
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const markAll = async () => {
    try { await markReadFn() } catch { /* server may be unreachable — still clear locally */ }
    setItems((prev) => (prev || []).map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })))
    setUnread(0)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen((o) => !o); if (!open) load() }}
        className="relative rounded-full border border-sage-200 bg-white p-2 text-charcoal-500 transition-colors hover:bg-sage-50"
        aria-label="Notifications"
        title="Notifications"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-sage-200 bg-white shadow-elevated">
          <div className="flex items-center justify-between border-b border-sage-100 px-5 py-3.5">
            <p className="text-sm font-bold text-charcoal-900">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs font-semibold text-teal-600 transition-colors hover:text-teal-700 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items === null ? (
              <p className="px-5 py-10 text-center text-sm text-charcoal-400">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-charcoal-400">{emptyText}</p>
            ) : (
              items.map((n) => (
                <div key={n.notification_id} className={cx('flex gap-3 border-b border-sage-50 px-5 py-3.5 last:border-0', !n.read_at && 'bg-sage-50/60')}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-sage-100 text-sm">{TYPE_ICON[n.type] || '🔔'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-xs font-bold text-charcoal-900">{n.subject || TYPE_LABEL[n.type] || 'Notification'}</p>
                      <span className="shrink-0 text-[10px] text-charcoal-400">{timeAgo(n.sent_at)}</span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-charcoal-500">{n.message_body}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
