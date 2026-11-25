import { useEffect, useState } from 'react'

/** A tiny hash router (#/documents?q=letter) so no extra dependency is needed. */
function parse() {
  const raw = window.location.hash.replace(/^#/, '') || '/dashboard'
  const [path, qs = ''] = raw.split('?')
  return {
    path: path || '/dashboard',
    segments: path.split('/').filter(Boolean),
    query: Object.fromEntries(new URLSearchParams(qs)),
  }
}

export function useRoute() {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const onChange = () => setRoute(parse())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function navigate(to) {
  window.location.hash = to.startsWith('#') ? to : `#${to}`
}
