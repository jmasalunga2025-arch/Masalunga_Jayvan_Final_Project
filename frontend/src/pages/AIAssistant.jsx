import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Send, X } from 'lucide-react'
import { ConsentNotice, readConsent, useAIStatus } from '../components/AIAssist'
import Owl from '../components/Owl'
import { Field, PageHeader } from '../components/ui'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'

const TOOLS = [['improve', 'Improve wording'], ['rewrite', 'Rewrite formally'], ['formalize', 'Make polite'], ['shorten', 'Shorten'], ['correct', 'Fix grammar & spelling']]

function Writing({ ready, ensureConsent }) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const run = async (action) => {
    setError('')
    if (!text.trim()) { setError('Paste or type some text first.'); return }
    if (!ensureConsent()) return
    setBusy(action)
    try { const r = await api.post('/api/ai/transform', { action, text, consent: true }); setResult(r.suggestion) } catch (e) { setError(e.message) } finally { setBusy('') }
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card space-y-3 p-5">
        <Field label="Your text" htmlFor="aw"><textarea id="aw" rows={10} className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={8000} placeholder="Paste a paragraph, a draft letter, or rough notes…" /></Field>
        <div className="flex flex-wrap gap-2">{TOOLS.map(([a, l]) => <button key={a} className="btn-secondary btn-sm" disabled={!ready || Boolean(busy)} onClick={() => run(a)}>{busy === a ? 'Working…' : l}</button>)}</div>
        {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
      </div>
      <div className="card p-5">
        <div className="label">AI suggestion</div>
        {result === null ? <p className="text-sm text-slate-500">Suggestions appear here. Nothing changes until you accept it.</p> : <>
          <p className="whitespace-pre-wrap text-sm">{result}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-success btn-sm" onClick={() => { setText(result); setResult(null); toast.success('Suggestion applied to your text.') }}><Check size={14} /> Accept</button>
            <button className="btn-secondary btn-sm" onClick={() => setResult(null)}><X size={14} /> Reject</button>
            <button className="btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(result).then(() => toast.success('Copied.'), () => toast.error('Could not copy.'))}><Copy size={14} /> Copy</button>
          </div></>}
      </div>
    </div>
  )
}

function Chat({ ready, ensureConsent }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const end = useRef(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [messages, busy])
  const send = async (e) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || busy || !ensureConsent()) return
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next); setInput(''); setError(''); setBusy(true)
    try { const r = await api.post('/api/ai/chat', { messages: next, consent: true }); setMessages([...next, { role: 'assistant', content: r.reply }]) } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return (
    <div className="card flex h-[60vh] flex-col">
      <div className="scroll-thin flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && <div className="flex flex-col items-center py-8 text-center"><Owl pose="wave" size={110} /><p className="mt-2 text-sm text-slate-500">Ask about preparing a document or using DAMS.</p></div>}
        {messages.map((m, i) => <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${m.role === 'user' ? 'ml-auto bg-royal-700 text-white' : 'bg-royal-100 dark:bg-slate-700'}`}>{m.content}</div>)}
        {busy && <div className="flex items-center gap-2 text-sm text-slate-500"><Owl pose="read" size={36} /> Thinking…</div>}
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">{error}</p>}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-royal-100 p-3 dark:border-slate-700">
        <input className="input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question…" aria-label="Message" maxLength={4000} disabled={!ready} />
        <button className="btn-primary" disabled={!ready || busy || !input.trim()} aria-label="Send"><Send size={16} /></button>
      </form>
    </div>
  )
}

function Summarize({ ready, ensureConsent }) {
  const [docs, setDocs] = useState([])
  const [docId, setDocId] = useState('')
  const [text, setText] = useState('')
  const [summary, setSummary] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { api.get('/api/documents').then(setDocs).catch(() => {}) }, [])
  const run = async () => {
    setError(''); setSummary('')
    if (!docId && !text.trim()) { setError('Choose a document or paste some text.'); return }
    if (!ensureConsent()) return
    setBusy(true)
    try { const r = await api.post('/api/ai/summarize', docId ? { document_id: Number(docId), consent: true } : { text, consent: true }); setSummary(r.summary) } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card space-y-3 p-5">
        <Field label="Summarize one of your documents" htmlFor="sd"><select id="sd" className="input" value={docId} onChange={(e) => setDocId(e.target.value)}><option value="">— or paste text below —</option>{docs.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select></Field>
        {!docId && <Field label="Text" htmlFor="st"><textarea id="st" rows={8} className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={8000} /></Field>}
        <button className="btn-primary" disabled={!ready || busy} onClick={run}>{busy ? 'Summarizing…' : 'Summarize'}</button>
        {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
      </div>
      <div className="card p-5"><div className="label">Summary</div>{summary ? <p className="whitespace-pre-wrap text-sm">{summary}</p> : <p className="text-sm text-slate-500">The summary appears here.</p>}</div>
    </div>
  )
}

export default function AIAssistant() {
  const status = useAIStatus()
  const [tab, setTab] = useState('writing')
  const [consented, setConsented] = useState(readConsent)
  const ready = Boolean(status?.configured)
  const ensureConsent = () => consented
  const Tab = { writing: Writing, chat: Chat, summarize: Summarize }[tab]
  return (
    <div>
      <PageHeader title="AI Assistant" subtitle="Help with wording, grammar and summaries. You stay in control: suggestions are only applied when you accept them." />
      {status && !status.configured && (
        <div className="mb-4 flex items-center gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100">
          <Owl pose="confused" size={72} /><div><b>AI is not set up on this server.</b><p>{status.message}</p></div>
        </div>)}
      {ready && !consented && <div className="mb-4"><ConsentNotice onAgree={() => setConsented(true)} /></div>}
      <div className="mb-4 flex gap-2">{[['writing', 'Writing tools'], ['chat', 'Chat'], ['summarize', 'Summarizer']].map(([k, l]) => (
        <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${tab === k ? 'bg-royal-700 text-white' : 'bg-white ring-1 ring-royal-100 hover:bg-royal-100 dark:bg-slate-800 dark:ring-slate-700'}`}>{l}</button>))}</div>
      <Tab ready={ready && consented} ensureConsent={ensureConsent} />
    </div>
  )
}
