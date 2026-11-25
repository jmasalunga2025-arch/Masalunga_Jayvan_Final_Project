import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, CheckCheck, Download, Info, Save, Send, ShieldCheck } from 'lucide-react'
import AIAssist, { useAIStatus } from '../components/AIAssist'
import DocumentPaper from '../components/DocumentPaper'
import Owl from '../components/Owl'
import TemplateCard from '../components/TemplateCard'
import { ErrorState, Field, OwlLoader, PageHeader } from '../components/ui'
import { useToast } from '../context/ToastContext'
import { api, downloadFile } from '../lib/api'
import { initialValues } from '../lib/format'
import { navigate } from '../lib/router'

const autosaveKey = (templateId) => `dams_autosave_${templateId}`
const readAutosave = (id) => { try { return JSON.parse(localStorage.getItem(autosaveKey(id)) || 'null') } catch { return null } }
const writeAutosave = (id, data) => { try { localStorage.setItem(autosaveKey(id), JSON.stringify(data)) } catch { /* ignore */ } }
const clearAutosave = (id) => { try { localStorage.removeItem(autosaveKey(id)) } catch { /* ignore */ } }

/* ------------------------------------------------------------------ template picker */
function Picker() {
  const [templates, setTemplates] = useState(null)
  const [error, setError] = useState('')
  const load = () => { setError(''); api.get('/api/templates').then(setTemplates).catch((e) => setError(e.message)) }
  useEffect(load, [])
  if (error) return <ErrorState message={error} onRetry={load} />
  if (!templates) return <OwlLoader />
  return (
    <div>
      <PageHeader title="Document Generator" subtitle="Choose a template to start. You will see the page update as you type." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {templates.map((t) => (
          <TemplateCard key={t.id} template={t} onUse={(x) => navigate(`/generator?template=${x.id}`)}
            onFavorite={async (x) => { const r = await api.post(`/api/templates/${x.id}/favorite`).catch(() => null); if (r) setTemplates((l) => l.map((y) => (y.id === x.id ? { ...y, is_favorite: r.is_favorite } : y))) }} />
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ field input */
function FieldInput({ field, value, onChange, error, templateId, values, status }) {
  const ref = useRef(null)
  const id = `f_${field.key}`
  const common = { id, value, className: `input ${error ? 'input-error' : ''}`, placeholder: field.placeholder || '', 'aria-invalid': Boolean(error) }
  return (
    <Field label={`${field.label}${field.required === false ? ' (optional)' : ''}`} error={error} htmlFor={id}>
      {field.type === 'textarea'
        ? <>
          <textarea ref={ref} rows={5} {...common} onChange={(e) => onChange(e.target.value)} />
          <AIAssist value={value} onChange={onChange} templateId={templateId} fieldKey={field.key} values={values} textareaRef={ref} status={status} />
        </>
        : <input type={field.type === 'date' ? 'date' : 'text'} {...common} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  )
}

/* ------------------------------------------------------------------ checker results */
function CheckResults({ result, onClose }) {
  const icon = { error: <AlertTriangle size={14} className="text-red-500" />, warning: <AlertTriangle size={14} className="text-amber-500" />, info: <Info size={14} className="text-sky-500" />, ok: <CheckCheck size={14} className="text-emerald-500" /> }
  return (
    <div className="card animate-pop-in p-4">
      <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold">Document check</h3><button className="text-xs font-semibold text-royal-700 hover:underline dark:text-royal-300" onClick={onClose}>Hide</button></div>
      <ul className="space-y-1.5 text-sm">
        {result.issues.map((i, n) => <li key={n} className="flex items-start gap-2"><span className="mt-1">{icon[i.level]}</span><span>{i.message}</span></li>)}
      </ul>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">These automatic checks run on this server only; nothing is sent to an AI service.</p>
    </div>
  )
}

/* ------------------------------------------------------------------ editor */
function Editor({ templateId, docId }) {
  const toast = useToast()
  const aiStatus = useAIStatus()
  const [template, setTemplate] = useState(null)
  const [doc, setDoc] = useState(null)
  const [title, setTitle] = useState('')
  const [values, setValues] = useState({})
  const [content, setContent] = useState('')           // only for documents without a template
  const [preview, setPreview] = useState(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(null)             // last saved/submitted document
  const [check, setCheck] = useState(null)
  const [restored, setRestored] = useState(false)
  const reqId = useRef(0)

  /* load template and/or document */
  const load = useCallback(async () => {
    setError('')
    try {
      let d = null
      let tid = templateId
      if (docId) { d = await api.get(`/api/documents/${docId}`); tid = d.template_id }
      setDoc(d)
      if (tid) {
        const t = await api.get(`/api/templates/${tid}`)
        setTemplate(t)
        if (d) { setTitle(d.title); setValues({ ...initialValues(t.fields), ...d.field_values }) } else {
          const base = initialValues(t.fields)
          const backup = readAutosave(t.id)
          setTitle(backup?.title || t.name)
          setValues(backup ? { ...base, ...backup.values } : base)
          setRestored(Boolean(backup))
        }
      } else if (d) { setTemplate(null); setTitle(d.title); setContent(d.content) }
    } catch (e) { setError(e.message) }
  }, [templateId, docId])
  useEffect(() => { setTemplate(null); setDoc(null); setSaved(null); setCheck(null); load() }, [load])

  /* live preview: debounced, and stale answers are ignored */
  useEffect(() => {
    if (!template) return undefined
    setPending(true)
    const my = ++reqId.current
    const timer = setTimeout(async () => {
      try {
        const r = await api.post(`/api/templates/${template.id}/preview`, { values, title })
        if (my === reqId.current) { setPreview(r); setPending(false) }
      } catch (e) { if (my === reqId.current) { setPending(false); setError(e.message) } }
    }, 250)
    return () => clearTimeout(timer)
  }, [template, values, title])

  /* documents without a template: show the stored page */
  useEffect(() => {
    if (template || !doc) return
    api.get(`/api/documents/${doc.id}/render`).then(setPreview).catch((e) => setError(e.message))
  }, [template, doc])

  /* local backup of unsaved work so a closed tab does not lose it */
  useEffect(() => {
    if (!template || doc) return undefined
    const t = setTimeout(() => writeAutosave(template.id, { title, values }), 600)
    return () => clearTimeout(t)
  }, [template, doc, title, values])

  const fields = template?.fields || []
  const missing = useMemo(() => fields.filter((f) => f.required !== false && !String(values[f.key] ?? '').trim()), [fields, values])
  const locked = doc && !doc.can_edit
  const setValue = (key) => (v) => setValues((cur) => ({ ...cur, [key]: v }))

  const save = async (submit) => {
    setTouched(true)
    if (!title.trim()) { toast.error('Give the document a title first.'); return }
    if (submit && missing.length) { toast.error(`Complete the required fields first: ${missing.map((m) => m.label).join(', ')}.`); return }
    setBusy(true)
    try {
      let result
      if (doc) {
        result = await api.patch(`/api/documents/${doc.id}`, template ? { title, field_values: values } : { title, content })
        if (submit) result = await api.post(`/api/documents/${doc.id}/submit`)
      } else {
        result = await api.post('/api/documents', { title, template_id: template.id, field_values: values, action: submit ? 'submit' : 'draft' })
      }
      if (template) clearAutosave(template.id)
      setDoc(result); setSaved({ doc: result, submitted: submit })
      if (!docId) window.history.replaceState(null, '', `#/generator?doc=${result.id}`)
      toast.success(submit ? 'Submitted for approval.' : 'Draft saved.')
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  const runCheck = async () => {
    try { setCheck(await api.post('/api/ai/check', { template_id: template.id, values })) } catch (e) { toast.error(e.message) }
  }

  const download = (fmt) => downloadFile(`/api/documents/${doc.id}/download/${fmt}`, `${title}.${fmt}`).catch((e) => toast.error(e.message))

  if (error && !preview && !template) return <ErrorState message={error} onRetry={load} />
  if (!template && !(doc && !doc.template_id)) return <OwlLoader label="Opening the editor…" />

  return (
    <div>
      <PageHeader title={doc ? 'Edit document' : 'New document'} subtitle={template ? `${template.name} · ${template.category}` : 'Plain document'}>
        <button className="btn-ghost" onClick={() => navigate(doc ? '/documents' : '/templates')}><ArrowLeft size={16} /> Back</button>
      </PageHeader>

      {locked && <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100">This document is “{doc.status}” and locked. Duplicate it from My Documents to make changes.</p>}
      {restored && !doc && (
        <p className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-royal-200 bg-royal-50 p-3 text-sm text-royal-900 dark:border-slate-600 dark:bg-slate-800 dark:text-royal-100">
          We restored your unsaved work from this browser.
          <button className="font-semibold underline" onClick={() => { clearAutosave(template.id); setValues(initialValues(fields)); setTitle(template.name); setRestored(false) }}>Start over</button>
        </p>
      )}
      {doc?.status === 'Draft' && doc.approval_comment && (
        <p className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-700 dark:bg-red-900/20 dark:text-red-100"><b>Reviewer comment:</b> {doc.approval_comment}</p>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(340px,440px)_1fr]">
        {/* ---------------- form ---------------- */}
        <div className="space-y-4">
          <div className="card space-y-4 p-5">
            {touched && missing.length > 0 && !saved && (
              <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-100" role="alert">
                <Owl pose="confused" size={56} />
                <span>{missing.length} required field{missing.length > 1 ? 's' : ''} still empty. Drafts can be saved anyway; submitting needs them all.</span>
              </div>
            )}
            <Field label="Document title" htmlFor="doc_title" error={touched && !title.trim() ? 'A title is required.' : ''}>
              <input id="doc_title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} disabled={locked} maxLength={200} />
            </Field>
            <fieldset disabled={locked} className="space-y-4">
              {template
                ? fields.map((f) => (
                  <FieldInput key={f.key} field={f} value={values[f.key] ?? ''} onChange={setValue(f.key)} templateId={template.id} values={values} status={aiStatus}
                    error={touched && f.required !== false && !String(values[f.key] ?? '').trim() ? `${f.label} is required.` : ''} />))
                : <Field label="Content" htmlFor="plain_content"><textarea id="plain_content" rows={14} className="input" value={content} onChange={(e) => setContent(e.target.value)} /></Field>}
            </fieldset>
          </div>

          {check && <CheckResults result={check} onClose={() => setCheck(null)} />}

          <div className="card sticky bottom-3 z-10 flex flex-wrap gap-2 p-3">
            <button className="btn-secondary" onClick={() => save(false)} disabled={busy || locked}><Save size={16} /> Save draft</button>
            <button className="btn-primary" onClick={() => save(true)} disabled={busy || locked}><Send size={16} /> Submit for approval</button>
            {template && <button className="btn-ghost" onClick={runCheck}><ShieldCheck size={16} /> Check</button>}
          </div>
        </div>

        {/* ---------------- live preview ---------------- */}
        <div className="min-w-0 xl:sticky xl:top-20">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Live preview</h2>
            <span className="text-xs text-slate-400">{pending ? 'Updating…' : 'Up to date'}</span>
          </div>
          <div className="scroll-thin overflow-auto rounded-2xl bg-royal-100/70 p-3 dark:bg-slate-900 sm:p-5">
            {preview ? <DocumentPaper doc={preview} pending={pending} /> : <OwlLoader label="Preparing preview…" />}
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Yellow brackets mark required details that are still empty. Word and PDF files use the same layout; exact fonts can differ slightly.</p>
        </div>
      </div>

      {saved && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && setSaved(null)}>
          <div className="card w-full max-w-md animate-pop-in p-6 text-center" role="dialog" aria-modal="true" aria-label="Document saved">
            <Owl pose={saved.submitted ? 'approved' : 'celebrate'} size={150} className="mx-auto" />
            <h2 className="mt-2 text-xl font-extrabold text-royal-900 dark:text-white">{saved.submitted ? 'Sent for approval!' : 'Draft saved!'}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{saved.doc.reference_no} · {saved.doc.title}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button className="btn-primary" onClick={() => download('docx')}><Download size={16} /> Word</button>
              <button className="btn-primary" onClick={() => download('pdf')}><Download size={16} /> PDF</button>
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button className="btn-secondary btn-sm" onClick={() => setSaved(null)}>Keep editing</button>
              <button className="btn-secondary btn-sm" onClick={() => navigate('/documents')}>Go to My Documents</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Generator({ route }) {
  const templateId = route.query.template ? Number(route.query.template) : null
  const docId = route.query.doc ? Number(route.query.doc) : null
  if (!templateId && !docId) return <Picker />
  return <Editor key={`${templateId}-${docId}`} templateId={templateId} docId={docId} />
}

