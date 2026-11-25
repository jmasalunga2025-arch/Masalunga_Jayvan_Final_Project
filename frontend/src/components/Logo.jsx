import { useId } from 'react'

/**
 * DAMS mark: a folded document page, an owl face looking out of it, and a small
 * "approved" check badge. Original artwork, drawn in SVG so it is crisp at any size
 * and reads on both light and dark backgrounds.
 */
export function LogoMark({ size = 40, className = '', title = 'DAMS' }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label={title}>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7C3AED" />
          <stop offset="1" stopColor="#4C1D95" />
        </linearGradient>
      </defs>
      <path d="M14 4H40L56 20V56a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z" fill={`url(#g${id})`} />
      <path d="M40 4V16a4 4 0 0 0 4 4H56Z" fill="#C4B5FD" />
      <path d="M18 19 27 26 17 28Z M50 19 41 26 51 28Z" fill="#DDD6FE" />
      <circle cx="26" cy="33" r="8" fill="#fff" />
      <circle cx="42" cy="33" r="8" fill="#fff" />
      <circle cx="27" cy="34" r="3.4" fill="#0F172A" />
      <circle cx="41" cy="34" r="3.4" fill="#0F172A" />
      <path d="M31.5 38.5H36.5L34 44Z" fill="#F59E0B" />
      <path d="M17 52H29M17 56.5H25" stroke="#C4B5FD" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="48" cy="50" r="9" fill="#22C55E" stroke="#fff" strokeWidth="2.5" />
      <path d="m43.5 50.5 3.5 3.5 6-7.5" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Primary logo: mark + wordmark + tagline. `tone="light"` is for dark/purple backgrounds. */
export function Logo({ size = 44, tone = 'auto', tagline = true }) {
  const text = tone === 'light' ? 'text-white' : 'text-royal-900 dark:text-white'
  const sub = tone === 'light' ? 'text-royal-200' : 'text-slate-500 dark:text-slate-400'
  return (
    <div className="flex items-center gap-3">
      <LogoMark size={size} />
      <div className="leading-tight">
        <div className={`text-xl font-extrabold tracking-tight ${text}`}>DAMS</div>
        {tagline && <div className={`text-[11px] font-medium ${sub}`}>Document Automation</div>}
      </div>
    </div>
  )
}

/** Sidebar logo: collapses to the mark alone. */
export function SidebarLogo({ collapsed }) {
  return (
    <div className="flex items-center gap-3 overflow-hidden">
      <LogoMark size={36} className="shrink-0" />
      {!collapsed && (
        <div className="leading-tight transition-opacity duration-200">
          <div className="text-lg font-extrabold tracking-tight text-white">DAMS</div>
          <div className="text-[10px] font-medium text-royal-200">Document Automation</div>
        </div>
      )}
    </div>
  )
}
