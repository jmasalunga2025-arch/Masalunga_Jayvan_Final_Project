import { useCallback, useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import Owl from '../components/Owl'
import { EmptyState, ErrorState, Field, Modal, OwlLoader, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import { formatDate, timeAgo } from '../lib/format'
import { DocumentViewer } from './Documents'

export default function Approvals() {
  const { can } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('pending')
  const [pending, setPending] = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')
  const [reviewing, setReviewing] = useState(null)   // { doc, decision }
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [stamp, setStamp] = useState(false)
  const [viewId, setViewId] = useState(null)

  const load = useCallback(() => {
    setError('')
    Promise.all([api.get('/api/approvals'), api.get('/api/approvals/history')]).then(([p, h]) => { setPending(p); setHistory(h) }).catch((e) => setError(e.message))
  }, [])
  useEffect(() => { if (can('documents.review')) load() }, [can, load])

  if (!can('documents.review')) return <EmptyState pose="confused" title="Approvers only">Your role cannot review documents. Ask an administrator if you need access.</EmptyState>
  if (error) return <ErrorState message={error} onRetry={load} />
  if (!pending) return <OwlLoader />

  const decide = async () => {
    if (reviewing.decision === 'reject' && !comment.trim()) { toast.error('Please explain the rejection so the owner can fix it.'); return }
    setBusy(true)
    try {
      await api.post(`/api/approvals/${reviewing.doc.id}/decision`, { decision: reviewing.decision, comment })
      if (reviewing.decision === 'approve') { setStamp(true); setTimeout(() => setStamp(false), 2400) } else toast.info('Document rejected. The owner has been notified.')
      setReviewing(null); setComment(''); load()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  return (
    <div>
      <PageHeader title="Approvals" subtitle="Review submitted documents. Rejections need a comment." />
      <div className="mb-4 flex gap-2">
        {[['pending', `Waiting (${pending.length})`], ['history', 'Decisions']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${tab === k ? 'bg-royal-700 text-white' : 'bg-white ring-1 ring-royal-100 hover:bg-royal-100 dark:bg-slate-800 dark:ring-slate-700'}`}>{label}</button>))}
      </div>

      {tab === 'pending' ? (pending.length === 0
        ? <div className="card"><EmptyState title="Inbox zero">No documents are waiting for review.</EmptyState></div>
        : <div className="grid gap-3">{pending.map((d) => (
          <div key={d.id} className="card flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1"><button className="font-semibold hover:underline" onClick={() => setViewId(d.id)}>{d.title}</button>
              <p className="text-xs text-slate-500 dark:text-slate-400">{d.template_name || 'Plain text'} · from {d.owner_name || 'unknown'} · submitted {timeAgo(d.submitted_at)}</p></div>
            <button className="btn-secondary btn-sm" onClick={() => setViewId(d.id)}>Review</button>
            <button className="btn-success btn-sm" onClick={() => { setReviewing({ doc: d, decision: 'approve' }); setComment('') }}><Check size={14} /> Approve</button>
            <button className="btn-danger btn-sm" onClick={() => { setReviewing({ doc: d, decision: 'reject' }); setComment('') }}><X size={14} /> Reject</button>
          </div>))}</div>)
        : (history.length === 0 ? <div className="card"><EmptyState title="No decisions yet" /></div>
          : <div className="card divide-y divide-royal-100 dark:divide-slate-700">{history.map((h) => (
            <div key={h.id} className="px-5 py-3 text-sm"><b className={h.decision === 'Approved' ? 'text-emerald-600' : 'text-red-600'}>{h.decision}</b> · {h.document_title}
              <span className="block text-xs text-slate-500">{h.reviewer_name} · {formatDate(h.created_at, true)}{h.comment ? ` · “${h.comment}”` : ''}</span></div>))}</div>)}

      {viewId && <DocumentViewer id={viewId} onClose={() => setViewId(null)} />}
      {reviewing && (
        <Modal title={reviewing.decision === 'approve' ? 'Approve document' : 'Reject document'} onClose={() => setReviewing(null)}
          footer={<><button className="btn-secondary" onClick={() => setReviewing(null)}>Cancel</button><button className={reviewing.decision === 'approve' ? 'btn-success' : 'btn-danger'} disabled={busy} onClick={decide}>{busy ? 'Saving…' : reviewing.decision === 'approve' ? 'Approve' : 'Reject'}</button></>}>
          <p className="mb-3 text-sm">“{reviewing.doc.title}”</p>
          <Field label={reviewing.decision === 'reject' ? 'Reason (required)' : 'Comment (optional)'} htmlFor="rc"><textarea id="rc" rows={4} className="input" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} /></Field>
        </Modal>)}
      {stamp && <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/30"><div className="card animate-pop-in p-6"><Owl pose="approved" size={220} /></div></div>}
    </div>
  )
}
