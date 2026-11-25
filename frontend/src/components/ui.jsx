import { useEffect } from 'react'
import { X } from 'lucide-react'
import Owl from './Owl'

const STATUS_STYLES = {
  Draft: 'bg-slate-100 text-slate-700 ring-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600',
  'Pending Approval': 'bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:ring-amber-700',
  Approved: 'bg-emerald-100 text-emerald-800 ring-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:ring-emerald-700',
  Rejected: 'bg-red-100 text-red-800 ring-red-300 dark:bg-red-900/40 dark:text-red-200 dark:ring-red-700',
}

export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[status] || STATUS_STYLES.Draft}`}>
      {status}
    </span>
  )
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-royal-900 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

/** Owl + message, used for empty and error states. */
export function EmptyState({ pose = 'empty', title, children, action }) {
  return (
    <div className="flex animate-fade-up flex-col items-center px-4 py-12 text-center">
      <Owl pose={pose} size={132} />
      <h3 className="mt-3 text-lg font-bold text-royal-900 dark:text-white">{title}</h3>
      {children && <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <EmptyState pose="error" title="Something went wrong"
      action={onRetry && <button className="btn-primary" onClick={onRetry}>Try again</button>}>
      {message}
    </EmptyState>
  )
}

/** Full-area loader: the owl reads a paper. */
export function OwlLoader({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16" role="status" aria-live="polite">
      <Owl pose="read" size={110} />
      <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  )
}

export function Modal({ title, onClose, children, wide = false, footer }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className={`card flex max-h-[92vh] w-full animate-pop-in flex-col rounded-b-none sm:rounded-b-2xl ${wide ? 'max-w-5xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between border-b border-royal-100 px-5 py-3 dark:border-slate-700">
          <h2 className="text-base font-bold text-royal-900 dark:text-white">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-royal-100 px-5 py-3 dark:border-slate-700">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({ title, message, confirmLabel = 'Delete', danger = true, busy = false, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}
      footer={<>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>{busy ? 'Working…' : confirmLabel}</button>
      </>}>
      <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
    </Modal>
  )
}

export function Field({ label, error, hint, children, htmlFor }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
        : hint ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  )
}
