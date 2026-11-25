import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

const ToastContext = createContext(null)
const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info }
const TONES = {
  success: 'border-emerald-300 text-emerald-800 dark:text-emerald-200',
  error: 'border-red-300 text-red-800 dark:text-red-200',
  info: 'border-royal-300 text-royal-900 dark:text-royal-100',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(1)

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), [])
  const push = useCallback((message, type = 'info') => {
    const id = nextId.current++
    setToasts((list) => [...list.slice(-3), { id, message, type }])
    setTimeout(() => dismiss(id), type === 'error' ? 7000 : 4000)
  }, [dismiss])

  const toast = {
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.type]
          return (
            <div key={t.id} className={`pointer-events-auto flex animate-slide-in items-start gap-3 rounded-xl border bg-white p-3 text-sm shadow-lift dark:bg-slate-800 ${TONES[t.type]}`}>
              <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p className="flex-1">{t.message}</p>
              <button className="icon-btn -m-1 h-6 w-6" onClick={() => dismiss(t.id)} aria-label="Dismiss"><X size={14} /></button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
