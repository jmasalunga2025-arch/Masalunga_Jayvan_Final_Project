export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatDate(value, withTime = false) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}) })
}

export function timeAgo(value) {
  const d = new Date(value)
  const seconds = Math.round((Date.now() - d.getTime()) / 1000)
  if (Number.isNaN(seconds)) return ''
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} d ago`
  return formatDate(value)
}

export function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?'

export function tint(hex, amount = 0.9) {
  const c = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16))
  const mix = (v) => Math.round(v + (255 - v) * amount)
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

/** Initial form values for a template: its defaults, with "@today" turned into today's date. */
export function initialValues(fields = []) {
  const values = {}
  fields.forEach((f) => { values[f.key] = f.default === '@today' ? todayISO() : f.default || '' })
  return values
}

export const ACTION_LABELS = {
  register: 'Created an account', login: 'Signed in', profile_update: 'Updated profile', password_change: 'Changed password',
  document_create: 'Created', document_edit: 'Edited', document_submit: 'Submitted', document_approved: 'Approved',
  document_rejected: 'Rejected', document_delete: 'Deleted', document_duplicate: 'Duplicated', document_download: 'Downloaded',
  template_create: 'Added template', template_delete: 'Removed template', user_update: 'Updated user',
}
