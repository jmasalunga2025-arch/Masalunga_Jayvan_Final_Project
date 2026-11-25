import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, FileText, LayoutTemplate, Plus, Bot, FolderOpen } from 'lucide-react'
import Owl from '../components/Owl'
import { EmptyState, ErrorState, OwlLoader, StatusBadge } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { ACTION_LABELS, greeting, timeAgo } from '../lib/format'

function Stat({ icon: Icon, label, value, tone, href }) {
  return (
    <a href={href} className="card flex items-center gap-4 p-4 transition-shadow duration-200 hover:shadow-lift">
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}><Icon size={22} /></span>
      <span><span className="block text-2xl font-extrabold leading-none">{value}</span><span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span></span>
    </a>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const load = () => { setError(''); api.get('/api/dashboard').then(setData).catch((e) => setError(e.message)) }
  useEffect(load, [])

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!data) return <OwlLoader />
  const s = data.stats
  return (
    <div className="space-y-6">
      <section className="card flex flex-wrap items-center gap-4 overflow-hidden bg-gradient-to-r from-royal-700 to-royal-900 p-6 text-white dark:border-0">
        <Owl pose="wave" size={120} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold">{greeting()}, {user.full_name.split(' ')[0]}!</h1>
          <p className="mt-1 text-royal-100">{s.pending > 0 ? `${s.pending} document${s.pending > 1 ? 's are' : ' is'} waiting for approval.` : 'Everything is up to date. Ready to create something?'}</p>
          <a href="#/templates" className="btn mt-3 bg-white text-royal-800 hover:bg-royal-50"><Plus size={16} /> Create a document</a>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={FileText} label="Total documents" value={s.total} tone="bg-royal-100 text-royal-700" href="#/documents" />
        <Stat icon={Clock} label="Pending approvals" value={s.pending} tone="bg-amber-100 text-amber-700" href="#/documents?status=Pending%20Approval" />
        <Stat icon={CheckCircle2} label="Approved documents" value={s.approved} tone="bg-emerald-100 text-emerald-700" href="#/documents?status=Approved" />
        <Stat icon={LayoutTemplate} label="Available templates" value={s.templates} tone="bg-sky-100 text-sky-700" href="#/templates" />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-royal-100 px-5 py-3 dark:border-slate-700">
            <h2 className="font-bold">Recent documents</h2><a href="#/documents" className="text-sm font-semibold text-royal-700 hover:underline dark:text-royal-300">View all</a>
          </div>
          {data.recent_documents.length === 0
            ? <EmptyState title="No documents yet" action={<a href="#/templates" className="btn-primary">Browse templates</a>}>Pick a template and your first document is a few clicks away.</EmptyState>
            : <ul className="divide-y divide-royal-100 dark:divide-slate-700">
              {data.recent_documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-royal-100 text-royal-700 dark:bg-slate-700 dark:text-royal-200"><FileText size={18} /></span>
                  <a href={`#/documents?view=${d.id}`} className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{d.title}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{d.template_name || 'Plain text'} · {timeAgo(d.updated_at)}</span>
                  </a>
                  <StatusBadge status={d.status} />
                </li>))}
            </ul>}
        </section>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 font-bold">Quick actions</h2>
            <div className="grid gap-2">
              <a href="#/templates" className="btn-secondary justify-start"><LayoutTemplate size={16} /> Browse templates</a>
              <a href="#/documents" className="btn-secondary justify-start"><FolderOpen size={16} /> My documents</a>
              <a href="#/ai" className="btn-secondary justify-start"><Bot size={16} /> Ask the AI assistant</a>
            </div>
          </section>
          <section className="card">
            <h2 className="border-b border-royal-100 px-5 py-3 font-bold dark:border-slate-700">Recent activity</h2>
            {data.recent_activity.length === 0 ? <p className="p-5 text-sm text-slate-500">Nothing yet.</p>
              : <ul className="divide-y divide-royal-100 dark:divide-slate-700">
                {data.recent_activity.map((a) => (
                  <li key={a.id} className="px-5 py-2.5 text-sm">
                    <span className="font-medium">{ACTION_LABELS[a.action] || a.action}</span>{a.detail ? <span className="text-slate-500 dark:text-slate-400"> · {a.detail}</span> : null}
                    <span className="block text-xs text-slate-400">{a.user_name && user.role === 'admin' ? `${a.user_name} · ` : ''}{timeAgo(a.created_at)}</span>
                  </li>))}
              </ul>}
          </section>
        </div>
      </div>
    </div>
  )
}
