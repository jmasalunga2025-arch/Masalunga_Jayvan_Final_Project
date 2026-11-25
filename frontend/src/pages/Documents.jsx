import { useCallback, useEffect, useState } from 'react'
import { Copy, Download, Eye, Pencil, Search, Send, Trash2 } from 'lucide-react'
import DocumentPaper from '../components/DocumentPaper'
import { ConfirmDialog, EmptyState, ErrorState, Modal, OwlLoader, PageHeader, StatusBadge } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api, downloadFile } from '../lib/api'
import { formatDate } from '../lib/format'
import { navigate } from '../lib/router'

export function DocumentViewer({ id, onClose, footerExtra }) {
  const toast = useToast()
  const [doc, setDoc] = useState(null)
  const [page, setPage] = useState(null)
  const [history, setHistory] = useState([])
  const [versions, setVersions] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    Promise.all([api.get(`/api/documents/${id}`), api.get(`/api/documents/${id}/render`), api.get(`/api/documents/${id}/approvals`), api.get(`/api/documents/${id}/versions`)])
      .then(([d, r, h, v]) => { setDoc(d); setPage(r); setHistory(h); setVersions(v) }).catch((e) => setError(e.message))
  }, [id])
  const dl = (fmt) => downloadFile(`/api/documents/${id}/download/${fmt}`, `document.${fmt}`).catch((e) => toast.error(e.message))
  return (
    <Modal wide title={doc ? doc.title : 'Document'} onClose={onClose}
      footer={<>{footerExtra}<button className="btn-secondary" onClick={() => dl('docx')} disabled={!doc}><Download size={16} /> Word</button><button className="btn-secondary" onClick={() => dl('pdf')} disabled={!doc}><Download size={16} /> PDF</button></>}>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : !doc ? <OwlLoader /> : (
        <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
          <div className="min-w-0 rounded-xl bg-royal-100/70 p-3 dark:bg-slate-900"><DocumentPaper doc={page} /></div>
          <aside className="space-y-4 text-sm">
            <div><StatusBadge status={doc.status} /><p className="mt-2 text-xs text-slate-500">{doc.reference_no}<br />Owner: {doc.owner_name || '-'}<br />Updated {formatDate(doc.updated_at, true)}</p></div>
            {doc.approval_comment && <div className="rounded-xl bg-red-50 p-3 text-red-900 dark:bg-red-900/20 dark:text-red-100"><b>Reviewer comment</b><p className="mt-1">{doc.approval_comment}</p></div>}
            <div><h3 className="label">Approval history</h3>{history.length === 0 ? <p className="text-xs text-slate-500">No decisions yet.</p> : <ul className="space-y-1.5 text-xs">{history.map((h) => <li key={h.id}><b>{h.decision}</b> by {h.reviewer_name || 'reviewer'} · {formatDate(h.created_at)}{h.comment ? <span className="block text-slate-500">“{h.comment}”</span> : null}</li>)}</ul>}</div>
            <div><h3 className="label">Versions</h3><ul className="space-y-1 text-xs">{versions.map((v) => <li key={v.id}>v{v.version_no} · {v.note} · {formatDate(v.created_at, true)}</li>)}</ul></div>
          </aside>
        </div>)}
    </Modal>
  )
}

export default function Documents({ route }) {
  const toast = useToast()
  const { user } = useAuth()
  const [docs, setDocs] = useState(null)
  const [categories, setCategories] = useState([])
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ q: route.query.q || '', status: route.query.status || '', category: '', date_from: '', date_to: '' })
  const [viewId, setViewId] = useState(route.query.view ? Number(route.query.view) : null)
  const [toDelete, setToDelete] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { setFilters((f) => ({ ...f, q: route.query.q || '', status: route.query.status || f.status })) }, [route.query.q, route.query.status])
  useEffect(() => { api.get('/api/templates/categories').then(setCategories).catch(() => {}) }, [])

  const load = useCallback(() => {
    const p = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => v && p.set(k, v))
    setError('')
    api.get(`/api/documents?${p}`).then(setDocs).catch((e) => setError(e.message))
  }, [filters])
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t) }, [load])

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }))
  const dl = (d, fmt) => downloadFile(`/api/documents/${d.id}/download/${fmt}`, `${d.title}.${fmt}`).catch((e) => toast.error(e.message))
  const act = async (fn, okMessage) => { try { await fn(); toast.success(okMessage); load() } catch (e) { toast.error(e.message) } }
  const confirmDelete = async () => { setBusy(true); await act(() => api.del(`/api/documents/${toDelete.id}`), 'Document deleted.'); setBusy(false); setToDelete(null) }

  return (
    <div>
      <PageHeader title="My Documents" subtitle={user.role === 'employee' ? 'Documents you created.' : 'Your documents and others you are allowed to see.'}>
        <button className="btn-primary" onClick={() => navigate('/templates')}>New document</button>
      </PageHeader>
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input pl-9" placeholder="Search title, text or reference…" value={filters.q} onChange={set('q')} aria-label="Search documents" /></div>
        <select className="input" value={filters.status} onChange={set('status')} aria-label="Status"><option value="">All statuses</option>{['Draft', 'Pending Approval', 'Approved', 'Rejected'].map((s) => <option key={s}>{s}</option>)}</select>
        <select className="input" value={filters.category} onChange={set('category')} aria-label="Template category"><option value="">All categories</option>{categories.map((c) => <option key={c}>{c}</option>)}</select>
        <div className="flex gap-2"><input type="date" className="input" value={filters.date_from} onChange={set('date_from')} aria-label="Created from" /><input type="date" className="input" value={filters.date_to} onChange={set('date_to')} aria-label="Created to" /></div>
      </div>

      {error ? <ErrorState message={error} onRetry={load} /> : !docs ? <OwlLoader /> : docs.length === 0
        ? <div className="card"><EmptyState title="No documents found" action={<button className="btn-primary" onClick={() => navigate('/templates')}>Create your first document</button>}>Nothing matches these filters yet.</EmptyState></div>
        : <div className="card overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-royal-100 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <tr><th className="px-4 py-3">Title</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Modified</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-royal-100 dark:divide-slate-700">
              {docs.map((d) => (
                <tr key={d.id} className="transition-colors hover:bg-royal-50/60 dark:hover:bg-slate-700/40">
                  <td className="px-4 py-3"><button className="text-left font-semibold hover:underline" onClick={() => setViewId(d.id)}>{d.title}</button><div className="text-xs text-slate-400">{d.reference_no}</div></td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{d.template_name || 'Plain text'}</td>
                  <td className="px-4 py-3">{d.owner_name || '-'}</td>
                  <td className="px-4 py-3">{formatDate(d.created_at)}</td>
                  <td className="px-4 py-3">{formatDate(d.updated_at)}</td>
                  <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-0.5">
                    <button className="icon-btn" title="View" aria-label={`View ${d.title}`} onClick={() => setViewId(d.id)}><Eye size={16} /></button>
                    {d.can_edit && <button className="icon-btn" title="Edit" aria-label={`Edit ${d.title}`} onClick={() => navigate(`/generator?doc=${d.id}`)}><Pencil size={16} /></button>}
                    <button className="icon-btn" title="Download Word" aria-label="Download Word file" onClick={() => dl(d, 'docx')}><Download size={16} /></button>
                    <button className="icon-btn" title="Duplicate" aria-label={`Duplicate ${d.title}`} onClick={() => act(() => api.post(`/api/documents/${d.id}/duplicate`), 'Copy created as a draft.')}><Copy size={16} /></button>
                    {d.can_submit && <button className="icon-btn" title="Submit for approval" aria-label={`Submit ${d.title}`} onClick={() => act(() => api.post(`/api/documents/${d.id}/submit`), 'Submitted for approval.')}><Send size={16} /></button>}
                    {d.can_delete && <button className="icon-btn hover:text-red-600" title="Delete" aria-label={`Delete ${d.title}`} onClick={() => setToDelete(d)}><Trash2 size={16} /></button>}
                  </div></td>
                </tr>))}
            </tbody>
          </table>
        </div>}

      {viewId && <DocumentViewer id={viewId} onClose={() => setViewId(null)} />}
      {toDelete && <ConfirmDialog title="Delete this document?" message={`“${toDelete.title}” and its version history will be permanently deleted. This cannot be undone.`} busy={busy} onConfirm={confirmDelete} onCancel={() => setToDelete(null)} />}
    </div>
  )
}
