import { useCallback, useEffect, useMemo, useState } from 'react'
import { Heart, Plus, Search } from 'lucide-react'
import TemplateCard from '../components/TemplateCard'
import { ConfirmDialog, EmptyState, ErrorState, Field, Modal, OwlLoader, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import { navigate } from '../lib/router'

function NewTemplateModal({ onClose, onCreated }) {
  const toast = useToast()
  const [form, setForm] = useState({ name: '', category: 'General', body: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setError('')
    if (!form.name.trim() || !form.body.trim()) { setError('Give the template a name and some text with {{placeholders}}.'); return }
    setBusy(true)
    try { await api.post('/api/templates', form); toast.success('Template created.'); onCreated() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal title="New plain-text template" onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Create template'}</button></>}>
      <div className="space-y-4">
        <Field label="Name" htmlFor="tn"><input id="tn" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Category" htmlFor="tc"><input id="tc" className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
        <Field label="Body" htmlFor="tb" hint="Use {{placeholder_name}} wherever a detail should be filled in, e.g. Dear {{client_name}},">
          <textarea id="tb" rows={8} className="input font-mono" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        </Field>
        {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}

export default function Templates() {
  const { can } = useAuth()
  const toast = useToast()
  const [templates, setTemplates] = useState(null)
  const [recent, setRecent] = useState([])
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('All')
  const [onlyFav, setOnlyFav] = useState(false)
  const [creating, setCreating] = useState(false)
  const [toDelete, setToDelete] = useState(null)

  const load = useCallback(() => {
    setError('')
    Promise.all([api.get('/api/templates'), api.get('/api/templates/recent')])
      .then(([all, rec]) => { setTemplates(all); setRecent(rec) }).catch((e) => setError(e.message))
  }, [])
  useEffect(load, [load])

  const categories = useMemo(() => ['All', ...new Set((templates || []).map((t) => t.category))], [templates])
  const shown = useMemo(() => (templates || []).filter((t) =>
    (category === 'All' || t.category === category) && (!onlyFav || t.is_favorite) &&
    (!q.trim() || `${t.name} ${t.description} ${t.category}`.toLowerCase().includes(q.trim().toLowerCase()))), [templates, category, onlyFav, q])

  const use = (t) => navigate(`/generator?template=${t.id}`)
  const favorite = async (t) => {
    try {
      const r = await api.post(`/api/templates/${t.id}/favorite`)
      setTemplates((list) => list.map((x) => (x.id === t.id ? { ...x, is_favorite: r.is_favorite } : x)))
    } catch (e) { toast.error(e.message) }
  }
  const remove = async () => {
    try { await api.del(`/api/templates/${toDelete.id}`); toast.success('Template deleted.'); setToDelete(null); load() } catch (e) { toast.error(e.message); setToDelete(null) }
  }

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!templates) return <OwlLoader label="Loading templates…" />

  const grouped = categories.filter((c) => c !== 'All').map((c) => [c, shown.filter((t) => t.category === c)]).filter(([, list]) => list.length)
  return (
    <div>
      <PageHeader title="Templates" subtitle="Professionally laid out documents. Pick one and fill in the details.">
        {can('templates.manage') && <button className="btn-secondary" onClick={() => setCreating(true)}><Plus size={16} /> New plain-text template</button>}
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search templates…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search templates" />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Category filter">
          {categories.map((c) => (
            <button key={c} onClick={() => setCategory(c)} aria-pressed={category === c}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 ${category === c ? 'bg-royal-700 text-white' : 'bg-white text-slate-600 ring-1 ring-royal-100 hover:bg-royal-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700'}`}>{c}</button>
          ))}
          <button onClick={() => setOnlyFav((v) => !v)} aria-pressed={onlyFav}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 ${onlyFav ? 'bg-rose-500 text-white' : 'bg-white text-slate-600 ring-1 ring-royal-100 hover:bg-royal-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700'}`}><Heart size={14} /> Favorites</button>
        </div>
      </div>

      {recent.length > 0 && !q && category === 'All' && !onlyFav && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Recently used</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {recent.slice(0, 4).map((t) => <TemplateCard key={t.id} template={t} onUse={use} onFavorite={favorite} onDelete={setToDelete} canDelete={can('templates.manage')} />)}
          </div>
        </section>
      )}

      {shown.length === 0
        ? <EmptyState title="No templates match" action={<button className="btn-secondary" onClick={() => { setQ(''); setCategory('All'); setOnlyFav(false) }}>Clear filters</button>}>Try a different search or category.</EmptyState>
        : grouped.map(([cat, list]) => (
          <section key={cat} className="mb-8">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{cat}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {list.map((t) => <TemplateCard key={t.id} template={t} onUse={use} onFavorite={favorite} onDelete={setToDelete} canDelete={can('templates.manage')} />)}
            </div>
          </section>))}

      {creating && <NewTemplateModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load() }} />}
      {toDelete && <ConfirmDialog title="Delete template?" message={`“${toDelete.name}” will be removed. Documents already made from it keep their text.`} onConfirm={remove} onCancel={() => setToDelete(null)} />}
    </div>
  )
}
