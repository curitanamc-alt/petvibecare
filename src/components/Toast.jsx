import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { cx } from './ui.jsx'

const ToastContext = createContext(null)

let id = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const remove = useCallback((tid) => {
    clearTimeout(timers.current[tid])
    delete timers.current[tid]
    setToasts((t) => t.filter((x) => x.id !== tid))
  }, [])

  const toast = useCallback((message, { type = 'info', duration = 4000 } = {}) => {
    const tid = ++id
    setToasts((t) => [...t, { id: tid, message, type }])
    timers.current[tid] = setTimeout(() => remove(tid), duration)
  }, [remove])

  // cleanup on unmount
  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout) }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col-reverse gap-3 pointer-events-none" style={{ maxWidth: 380 }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3.5 shadow-elevated animate-slide-up',
              t.type === 'success' && 'border-teal-600/20 bg-teal-50 text-teal-800',
              t.type === 'error' && 'border-red-300 bg-red-50 text-red-700',
              t.type === 'info' && 'border-sage-200 bg-white text-charcoal-800',
              t.type === 'warning' && 'border-amber-300 bg-amber-50 text-amber-700',
            )}
          >
            <span className="mt-0.5 text-lg shrink-0">
              {t.type === 'success' && '✓'}
              {t.type === 'error' && '✕'}
              {t.type === 'info' && 'ℹ'}
              {t.type === 'warning' && '⚠'}
            </span>
            <p className="text-sm font-medium leading-relaxed">{t.message}</p>
            <button
              onClick={() => remove(t.id)}
              className="ml-2 mt-0.5 shrink-0 rounded p-0.5 text-current opacity-50 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
