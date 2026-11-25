import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, Bot, CheckSquare, ChevronsLeft, ChevronsRight, FileText, FolderOpen, HelpCircle, LayoutDashboard, LayoutTemplate, LogOut, Menu, Moon, Plus, Search, Settings, Sun } from 'lucide-react'
import { SidebarLogo } from './Logo'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { api } from '../lib/api'
import { initials, timeAgo } from '../lib/format'
import { navigate } from '../lib/router'

const NAV = [
  ['/dashboard', 'Dashboard', LayoutDashboard],
  ['/templates', 'Templates', LayoutTemplate],
  ['/generator', 'Document Generator', FileText],
  ['/documents', 'My Documents', FolderOpen],
  ['/approvals', 'Approvals', CheckSquare, 'documents.review'],
  ['/ai', 'AI Assistant', Bot],
  ['/settings', 'Settings', Settings],
]

function useOutsideClose(ref, close) {
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) close() }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [ref, close])
}

function Notifications() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const ref = useRef(null)
  const close = useCallback(() => setOpen(false), [])
  useOutsideClose(ref, close)

  const load = useCallback(() => api.get('/api/notifications').then(setItems).catch(() => {}), [])
  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [load])

  const unread = items.filter((n) => !n.is_read).length
  const readAll = async () => { await api.post('/api/notifications/read-all').catch(() => {}); load() }
  const openItem = async (n) => {
    if (!n.is_read) await api.post(`/api/notifications/${n.id}/read`).catch(() => {})
    setOpen(false); load()
    if (n.link) navigate(n.link)
  }

  return (
    <div className="relative" ref={ref}>
      <button className="icon-btn relative h-9 w-9" onClick={() => setOpen((o) => !o)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open}>
        <Bell size={18} />
        {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="card absolute right-0 z-40 mt-2 w-80 max-w-[90vw] animate-drop-in overflow-hidden">
          <div className="flex items-center justify-between border-b border-royal-100 px-4 py-2.5 dark:border-slate-700">
            <span className="text-sm font-bold">Notifications</span>
            {unread > 0 && <button className="text-xs font-semibold text-royal-700 hover:underline dark:text-royal-300" onClick={readAll}>Mark all read</button>}
          </div>
          <ul className="scroll-thin max-h-80 overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">You're all caught up.</li>}
            {items.map((n) => (
              <li key={n.id}>
                <button onClick={() => openItem(n)} className={`block w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-royal-50 dark:hover:bg-slate-700 ${n.is_read ? 'text-slate-500' : 'font-medium text-slate-900 dark:text-white'}`}>
                  {n.message}
                  <span className="mt-0.5 block text-xs font-normal text-slate-400">{timeAgo(n.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ProfileMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const close = useCallback(() => setOpen(false), [])
  useOutsideClose(ref, close)
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-xl p-1 pr-2 transition-colors hover:bg-royal-100 dark:hover:bg-slate-700" aria-haspopup="menu" aria-expanded={open}>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-royal-700 text-xs font-bold text-white">{initials(user.full_name)}</span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block max-w-[10rem] truncate text-sm font-semibold">{user.full_name}</span>
          <span className="block text-[11px] text-slate-500 dark:text-slate-400">{user.role_label}</span>
        </span>
      </button>
      {open && (
        <div className="card absolute right-0 z-40 mt-2 w-52 animate-drop-in p-1.5" role="menu">
          <button role="menuitem" className="btn-ghost w-full justify-start" onClick={() => { setOpen(false); navigate('/settings') }}><Settings size={16} /> Profile & settings</button>
          <button role="menuitem" className="btn-ghost w-full justify-start" onClick={logout}><LogOut size={16} /> Sign out</button>
        </div>
      )}
    </div>
  )
}

export default function Layout({ route, children }) {
  const { can } = useAuth()
  const { theme, setTheme, isDark } = useTheme()
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('dams_sidebar') === '1' } catch { return false } })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')
  const current = '/' + (route.segments[0] || 'dashboard')

  useEffect(() => setMobileOpen(false), [route.path])
  const toggleCollapsed = () => setCollapsed((c) => { try { localStorage.setItem('dams_sidebar', c ? '0' : '1') } catch { /* ignore */ } return !c })
  const submitSearch = (e) => { e.preventDefault(); navigate(`/documents${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''}`) }
  const nextTheme = () => setTheme(isDark ? 'light' : 'dark')

  const nav = (
    <nav className="mt-6 flex flex-col gap-1" aria-label="Main">
      {NAV.filter(([, , , perm]) => !perm || can(perm)).map(([to, label, Icon]) => (
        <a key={to} href={`#${to}`} title={collapsed ? label : undefined} aria-current={current === to ? 'page' : undefined}
          className={`nav-link ${current === to ? 'nav-link-active' : ''} ${collapsed ? 'justify-center' : ''}`}>
          <Icon size={18} className="shrink-0" />
          {!collapsed && <span className="truncate">{label}</span>}
        </a>
      ))}
    </nav>
  )

  return (
    <div className="flex min-h-screen">
      {mobileOpen && <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-gradient-to-b from-royal-900 to-royal-800 p-4 transition-all duration-300 ease-in-out dark:from-slate-950 dark:to-royal-900 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${collapsed ? 'lg:w-[76px]' : 'lg:w-64'} w-64 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarLogo collapsed={collapsed} />
        {nav}
        <button onClick={toggleCollapsed} className="nav-link mt-auto hidden justify-center lg:flex" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronsRight size={18} /> : <><ChevronsLeft size={18} /><span>Collapse</span></>}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-royal-100 bg-white/85 px-4 py-2.5 backdrop-blur dark:border-slate-700 dark:bg-night/85 sm:gap-3 sm:px-6">
          <button className="icon-btn h-9 w-9 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <form onSubmit={submitSearch} className="relative max-w-md flex-1" role="search">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Search documents…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search documents" />
          </form>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <button className="icon-btn h-9 w-9" onClick={nextTheme} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>{isDark ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button className="icon-btn hidden h-9 w-9 sm:inline-flex" onClick={() => navigate('/ai')} aria-label="Help and AI assistant" title="Help & AI assistant"><HelpCircle size={18} /></button>
            <Notifications />
            <button className="btn-primary hidden sm:inline-flex" onClick={() => navigate('/templates')}><Plus size={16} /> Create document</button>
            <button className="icon-btn h-9 w-9 bg-royal-700 text-white hover:bg-royal-800 hover:text-white sm:hidden" onClick={() => navigate('/templates')} aria-label="Create document"><Plus size={18} /></button>
            <ProfileMenu />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6" id="main">
          <div key={route.path} className="mx-auto max-w-7xl animate-fade-up">{children}</div>
        </main>
      </div>
    </div>
  )
}
