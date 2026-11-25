import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { Field, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'

function Profile() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ full_name: user.full_name, email: user.email })
  const [busy, setBusy] = useState(false)
  const save = async (e) => {
    e.preventDefault(); setBusy(true)
    try { setUser(await api.patch('/api/auth/me', form)); toast.success('Profile updated.') } catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={save} className="card space-y-4 p-5">
      <h2 className="font-bold">Profile</h2>
      <p className="text-xs text-slate-500">Username: {user.username} · Role: {user.role_label}</p>
      <Field label="Full name" htmlFor="pn"><input id="pn" className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
      <Field label="Email" htmlFor="pe"><input id="pe" type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
      <button className="btn-primary" disabled={busy}>Save profile</button>
    </form>
  )
}

function Password() {
  const toast = useToast()
  const [form, setForm] = useState({ current_password: '', new_password: '' })
  const save = async (e) => {
    e.preventDefault()
    try { await api.post('/api/auth/change-password', form); setForm({ current_password: '', new_password: '' }); toast.success('Password changed. Other devices were signed out.') } catch (err) { toast.error(err.message) }
  }
  return (
    <form onSubmit={save} className="card space-y-4 p-5">
      <h2 className="font-bold">Change password</h2>
      <Field label="Current password" htmlFor="cp"><input id="cp" type="password" autoComplete="current-password" className="input" value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} /></Field>
      <Field label="New password" htmlFor="np" hint="At least 8 characters, mixing letters and numbers."><input id="np" type="password" autoComplete="new-password" className="input" value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} /></Field>
      <button className="btn-primary">Change password</button>
    </form>
  )
}

function Appearance() {
  const { theme, setTheme } = useTheme()
  return (
    <div className="card p-5">
      <h2 className="mb-3 font-bold">Appearance</h2>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Theme">
        {[['light', 'Light', Sun], ['dark', 'Dark', Moon], ['system', 'System', Monitor]].map(([k, l, Icon]) => (
          <button key={k} aria-pressed={theme === k} onClick={() => setTheme(k)} className={`btn ${theme === k ? 'bg-royal-700 text-white' : 'btn-secondary'}`}><Icon size={16} /> {l}</button>))}
      </div>
    </div>
  )
}

function Users() {
  const { user: me } = useAuth()
  const toast = useToast()
  const [users, setUsers] = useState([])
  const load = () => api.get('/api/users').then(setUsers).catch((e) => toast.error(e.message))
  useEffect(() => { load() }, [])
  const update = async (u, patch) => { try { await api.patch(`/api/users/${u.id}`, patch); toast.success('User updated.'); load() } catch (e) { toast.error(e.message) } }
  return (
    <div className="card overflow-x-auto p-5">
      <h2 className="mb-3 font-bold">Users</h2>
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Name</th><th>Role</th><th>Active</th></tr></thead>
        <tbody className="divide-y divide-royal-100 dark:divide-slate-700">
          {users.map((u) => (
            <tr key={u.id}><td className="py-2"><b>{u.full_name}</b><div className="text-xs text-slate-500">{u.username} · {u.email}</div></td>
              <td><select className="input w-auto" aria-label={`Role for ${u.full_name}`} value={u.role} disabled={u.id === me.id} onChange={(e) => update(u, { role: e.target.value })}><option value="employee">Staff / Employee</option><option value="approver">Approver</option><option value="admin">Administrator</option></select></td>
              <td><input type="checkbox" className="h-4 w-4" aria-label={`Active: ${u.full_name}`} checked={u.is_active} disabled={u.id === me.id} onChange={(e) => update(u, { is_active: e.target.checked })} /></td></tr>))}
        </tbody>
      </table>
    </div>
  )
}

export default function Settings() {
  const { can } = useAuth()
  return (
    <div>
      <PageHeader title="Settings" subtitle="Your profile, password and appearance." />
      <div className="grid gap-6 lg:grid-cols-2"><Profile /><Password /><Appearance /></div>
      {can('users.manage') && <div className="mt-6"><Users /></div>}
    </div>
  )
}
