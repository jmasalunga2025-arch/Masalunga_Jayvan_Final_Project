const TOKEN_KEY = 'dams_token'

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export const setToken = (token) => {
  try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY) } catch { /* private mode */ }
}

let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

function errorMessage(data, status) {
  const detail = data && data.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((d) => String(d.msg || '').replace(/^Value error, /, '')).filter(Boolean).join(' ') || 'Please check the form and try again.'
  }
  if (status === 503) return 'The service is temporarily unavailable. Please try again.'
  return `Something went wrong (error ${status}).`
}

async function request(path, { method = 'GET', body, auth = true, blob = false } = {}) {
  const headers = {}
  const token = getToken()
  if (auth && token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let res
  try {
    res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  } catch {
    throw new ApiError('Cannot reach the DAMS server. Is the backend running on port 8000?', 0)
  }
  if (!res.ok) {
    let data = null
    try { data = await res.json() } catch { /* not JSON */ }
    if (res.status === 401 && auth && token) onUnauthorized()
    throw new ApiError(errorMessage(data, res.status), res.status)
  }
  if (res.status === 204) return null
  if (blob) return res
  return res.json()
}

export const api = {
  get: (path) => request(path),
  post: (path, body = {}, opts = {}) => request(path, { method: 'POST', body, ...opts }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
}

/** Downloads a protected file (the browser cannot send our Authorization header from a plain link). */
export async function downloadFile(path, fallbackName) {
  const res = await request(path, { blob: true })
  const disposition = res.headers.get('Content-Disposition') || ''
  const match = /filename="?([^";]+)"?/.exec(disposition)
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = match ? match[1] : fallbackName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
