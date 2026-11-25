import { useState } from 'react'
import { Logo } from '../components/Logo'
import Owl from '../components/Owl'
import { Field } from '../components/ui'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ identifier: '', username: '', email: '', full_name: '', password: '' })
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const validate = () => {
    const out = {}
    if (mode === 'login') {
      if (!form.identifier.trim()) out.identifier = 'Enter your username or email.'
      if (!form.password) out.password = 'Enter your password.'
    } else {
      if (form.full_name.trim().length < 2) out.full_name = 'Enter your full name.'
      if (!/^[A-Za-z0-9_.-]{3,32}$/.test(form.username.trim())) out.username = '3-32 letters, numbers, dot, dash or underscore.'
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) out.email = 'Enter a valid email address.'
      if (form.password.length < 8 || /^\d+$/.test(form.password) || /^[A-Za-z]+$/.test(form.password)) out.password = 'At least 8 characters, mixing letters and numbers.'
    }
    return out
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const v = validate()
    setErrors(v)
    if (Object.keys(v).length) return
    setBusy(true)
    try {
      if (mode === 'login') await login(form.identifier.trim(), form.password)
      else await register({ username: form.username.trim(), email: form.email.trim(), full_name: form.full_name.trim(), password: form.password })
      window.location.hash = '#/dashboard'
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const invalid = Object.keys(errors).length > 0 || Boolean(error)
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-royal-900 via-royal-800 to-royal-700 p-10 text-white lg:flex">
        <Logo tone="light" size={48} />
        <div className="flex flex-col items-center text-center">
          <Owl pose="wave" size={240} />
          <h2 className="mt-4 text-3xl font-extrabold">Documents, done properly.</h2>
          <p className="mt-2 max-w-sm text-royal-100">Pick a designed template, fill in the details, watch the page update live, and send it for approval.</p>
        </div>
        <p className="text-xs text-royal-200">Dami the owl keeps your paperwork tidy.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} noValidate className="card w-full max-w-md animate-fade-up space-y-4 p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-royal-900 dark:text-white">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{mode === 'login' ? 'Sign in to continue to DAMS.' : 'The first account created becomes the administrator.'}</p>
            </div>
            {invalid && <Owl pose="confused" size={64} />}
          </div>
          {mode === 'register' && <>
            <Field label="Full name" error={errors.full_name} htmlFor="full_name"><input id="full_name" className={`input ${errors.full_name ? 'input-error' : ''}`} value={form.full_name} onChange={set('full_name')} autoComplete="name" /></Field>
            <Field label="Username" error={errors.username} htmlFor="username"><input id="username" className={`input ${errors.username ? 'input-error' : ''}`} value={form.username} onChange={set('username')} autoComplete="username" /></Field>
            <Field label="Email" error={errors.email} htmlFor="email"><input id="email" type="email" className={`input ${errors.email ? 'input-error' : ''}`} value={form.email} onChange={set('email')} autoComplete="email" /></Field>
          </>}
          {mode === 'login' && <Field label="Username or email" error={errors.identifier} htmlFor="identifier"><input id="identifier" className={`input ${errors.identifier ? 'input-error' : ''}`} value={form.identifier} onChange={set('identifier')} autoComplete="username" autoFocus /></Field>}
          <Field label="Password" error={errors.password} htmlFor="password"><input id="password" type="password" className={`input ${errors.password ? 'input-error' : ''}`} value={form.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></Field>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-200">{error}</p>}
          <button className="btn-primary w-full py-2.5" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
            <button type="button" className="font-semibold text-royal-700 hover:underline dark:text-royal-300" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setErrors({}) }}>
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}
