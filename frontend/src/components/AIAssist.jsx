import { useEffect, useState } from 'react'
import { Check, Sparkles, Wand2, X } from 'lucide-react'
import { api } from '../lib/api'
import Owl from './Owl'

/* One shared answer to "may DAMS send my text to the AI provider?" for this browser tab. */
const CONSENT_KEY = 'dams_ai_consent'
export const readConsent = () => { try { return sessionStorage.getItem(CONSENT_KEY) === '1' } catch { return false } }
export const storeConsent = () => { try { sessionStorage.setItem(CONSENT_KEY, '1') } catch { /* ignore */ } }

export function useAIStatus() {
  const [status, setStatus] = useState(null)
  useEffect(() => { api.get('/api/ai/status').then(setStatus).catch(() => setStatus({ configured: false, message: 'Could not check the AI service.' })) }, [])
  return status
}

export function ConsentNotice({ onAgree }) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100">
      <p className="font-semibold">Before using AI</p>
      <p className="mt-1">The text you choose is sent to the AI provider configured by your administrator. Nothing is sent unless you press an AI button. You can always write and edit manually instead.</p>
      <button className="btn-primary btn-sm mt-2" onClick={() => { storeConsent(); onAgree() }}>I understand, continue</button>
    </div>
  )
}

const ACTIONS = [
  ['improve', 'Improve'], ['rewrite', 'Rewrite formally'], ['shorten', 'Shorten'], ['correct', 'Fix grammar'],
]

/** Word-level highlight so the user can compare the original and the suggestion. */
function SuggestionDiff({ original, suggestion }) {
  const known = new Set(original.toLowerCase().split(/\s+/))
  return (
    <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">
      {suggestion.split(/(\s+)/).map((w, i) => (/^\s+$/.test(w) || known.has(w.toLowerCase())
        ? w : <mark key={i} className="rounded bg-emerald-100 px-0.5 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100">{w}</mark>))}
    </p>
  )
}

/**
 * AI helper for a single text field. The user may select part of the text; with no selection the
 * whole field is used. The AI never edits anything by itself: it proposes, the user accepts or rejects.
 */
export default function AIAssist({ value, onChange, templateId, fieldKey, values, textareaRef, status }) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const [proposal, setProposal] = useState(null) // { kind, original, suggestion, range }
  const [consented, setConsented] = useState(readConsent)
  const [needConsent, setNeedConsent] = useState(false)

  const available = status?.configured

  const selection = () => {
    const el = textareaRef?.current
    if (el && el.selectionEnd > el.selectionStart) return { start: el.selectionStart, end: el.selectionEnd, text: value.slice(el.selectionStart, el.selectionEnd) }
    return { start: 0, end: value.length, text: value }
  }

  const run = async (kind, action) => {
    setError('')
    if (!consented) { setNeedConsent(true); return }
    const sel = selection()
    if (kind === 'transform' && !sel.text.trim()) { setError('Type or select some text first.'); return }
    setBusy(action)
    try {
      if (kind === 'suggest') {
        const r = await api.post('/api/ai/suggest', { template_id: templateId, field_key: fieldKey, values, consent: true })
        setProposal({ kind, original: value, suggestion: r.suggestion, range: [0, value.length] })
      } else {
        const r = await api.post('/api/ai/transform', { action, text: sel.text, consent: true })
        setProposal({ kind, original: sel.text, suggestion: r.suggestion, range: [sel.start, sel.end] })
      }
    } catch (e) {
      setError(e.message)
    } finally { setBusy(null) }
  }

  const accept = () => {
    const [s, e] = proposal.range
    onChange(value.slice(0, s) + proposal.suggestion + value.slice(e))
    setProposal(null)
  }

  const btn = 'inline-flex items-center gap-1 rounded-lg border border-royal-200 bg-white px-2 py-1 text-xs font-medium text-royal-800 transition-colors duration-150 hover:bg-royal-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-royal-200 dark:hover:bg-slate-700'

  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-royal-600 dark:text-royal-300"><Sparkles size={12} /> AI</span>
        <button type="button" className={btn} disabled={!available || busy} onClick={() => run('suggest', 'suggest')} title={available ? 'Draft this field from the other answers' : status?.message}>
          <Wand2 size={12} /> {busy === 'suggest' ? 'Drafting…' : 'Suggest text'}
        </button>
        {ACTIONS.map(([a, label]) => (
          <button type="button" key={a} className={btn} disabled={!available || busy} onClick={() => run('transform', a)}>{busy === a ? 'Working…' : label}</button>
        ))}
        {!available && status && <span className="text-[11px] text-slate-500 dark:text-slate-400">Unavailable – edit manually.</span>}
      </div>
      {available && <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Tip: select part of the text to change only that part.</p>}
      {needConsent && !consented && <div className="mt-2"><ConsentNotice onAgree={() => { setConsented(true); setNeedConsent(false) }} /></div>}
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-200" role="alert">{error}</p>}
      {proposal && (
        <div className="mt-2 animate-pop-in rounded-xl border border-royal-300 bg-royal-50/60 p-3 dark:border-royal-700 dark:bg-slate-900">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="label">Original</div>
              <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{proposal.original || '(empty)'}</p>
            </div>
            <div>
              <div className="label">AI suggestion</div>
              <SuggestionDiff original={proposal.original} suggestion={proposal.suggestion} />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-success btn-sm" onClick={accept}><Check size={14} /> Accept</button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setProposal(null)}><X size={14} /> Reject</button>
          </div>
        </div>
      )}
    </div>
  )
}

export { Owl }
