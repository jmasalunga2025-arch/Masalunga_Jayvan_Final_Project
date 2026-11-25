import { Heart, Plus, Trash2 } from 'lucide-react'
import { tint } from '../lib/format'

/** Light-weight thumbnail drawn per layout, so the gallery needs no extra requests. */
export function TemplateThumb({ layout, accent = '#6D28D9', frame = 'none' }) {
  const bar = (x, y, w, h = 4, c = '#D1D5DB') => <rect x={x} y={y} width={w} height={h} rx="2" fill={c} />
  const landscape = layout === 'certificate'
  const W = landscape ? 160 : 120
  const H = landscape ? 113 : 160
  let body
  switch (layout) {
    case 'certificate':
      body = <>
        <circle cx="80" cy="22" r="8" fill={tint(accent, 0.8)} stroke={accent} />
        {bar(50, 38, 60, 5, accent)}
        <rect x="34" y="52" width="92" height="9" rx="2" fill={tint(accent, 0.85)} />
        {bar(40, 70, 80)}{bar(48, 78, 64)}
        <line x1="30" y1="98" x2="66" y2="98" stroke="#9CA3AF" />{<line x1="94" y1="98" x2="130" y2="98" stroke="#9CA3AF" />}
      </>
      break
    case 'memo':
      body = <>
        {bar(34, 14, 52, 5, accent)}{bar(16, 28, 20, 3)}{bar(42, 28, 56, 3)}{bar(16, 36, 20, 3)}{bar(42, 36, 48, 3)}
        <line x1="16" y1="46" x2="104" y2="46" stroke={accent} />{bar(16, 56, 88)}{bar(16, 64, 80)}{bar(16, 72, 86)}{bar(16, 80, 60)}
        {bar(16, 138, 36, 3, '#9CA3AF')}
      </>
      break
    case 'announcement':
      body = <>
        {bar(30, 14, 60, 8, accent)}{bar(24, 30, 72, 5, '#9CA3AF')}
        <rect x="16" y="46" width="88" height="42" rx="4" fill={tint(accent, 0.9)} />
        {bar(24, 54, 50, 3, accent)}{bar(24, 64, 62, 3)}{bar(24, 74, 40, 3)}{bar(16, 100, 88)}{bar(16, 108, 70)}
      </>
      break
    case 'report':
    case 'form':
      body = <>
        {bar(34, 12, 52, 5, accent)}
        <rect x="16" y="26" width="88" height="9" rx="2" fill={layout === 'form' ? accent : tint(accent, 0.8)} />
        {bar(16, 42, 88)}{bar(16, 50, 74)}
        <rect x="16" y="62" width="88" height="9" rx="2" fill={layout === 'form' ? accent : tint(accent, 0.8)} />
        {bar(16, 78, 88)}{bar(16, 86, 80)}{bar(16, 94, 60)}{bar(16, 110, 40, 3, '#9CA3AF')}{bar(66, 110, 38, 3, '#9CA3AF')}
      </>
      break
    default: // letter / plain
      body = <>
        {bar(34, 12, 52, 5, accent)}<line x1="16" y1="24" x2="104" y2="24" stroke={accent} />
        {bar(70, 32, 34, 3)}{bar(16, 44, 46, 3, '#9CA3AF')}{bar(16, 58, 88)}{bar(16, 66, 88)}{bar(16, 74, 76)}{bar(16, 88, 88)}{bar(16, 96, 82)}{bar(16, 112, 34, 3, '#9CA3AF')}{bar(16, 120, 28, 3, '#9CA3AF')}
      </>
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" aria-hidden="true">
      <rect width={W} height={H} fill="#fff" />
      {frame !== 'none' && <rect x="5" y="5" width={W - 10} height={H - 10} fill="none" stroke={accent} strokeWidth={frame === 'classic' ? 3 : 1.6} />}
      {body}
    </svg>
  )
}

export default function TemplateCard({ template: t, onUse, onFavorite, onDelete, canDelete }) {
  return (
    <div className="card group flex animate-fade-up flex-col overflow-hidden transition-shadow duration-200 hover:shadow-lift">
      <div className="relative flex h-44 items-center justify-center p-4" style={{ background: tint(t.accent, 0.93) }}>
        <div className={`h-full overflow-hidden rounded-md shadow-md ring-1 ring-black/5 ${t.layout === 'certificate' ? 'aspect-[1.41/1]' : 'aspect-[1/1.41]'}`}>
          <TemplateThumb layout={t.layout} accent={t.accent} frame={t.frame} />
        </div>
        <button onClick={() => onFavorite(t)} aria-pressed={t.is_favorite} aria-label={t.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
          className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow transition-transform duration-150 hover:scale-110 dark:bg-slate-800/90">
          <Heart size={16} className={t.is_favorite ? 'fill-rose-500 text-rose-500' : 'text-slate-500'} />
        </button>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-royal-600 dark:text-royal-300">{t.category}</div>
        <h3 className="mt-0.5 font-bold text-slate-900 dark:text-white">{t.name}</h3>
        <p className="mt-1 line-clamp-2 flex-1 text-xs text-slate-500 dark:text-slate-400">{t.description}</p>
        <div className="mt-3 flex items-center gap-2">
          <button className="btn-primary btn-sm flex-1" onClick={() => onUse(t)}><Plus size={14} /> Create document</button>
          {canDelete && !t.is_builtin && (
            <button className="icon-btn" onClick={() => onDelete(t)} aria-label={`Delete template ${t.name}`}><Trash2 size={16} /></button>
          )}
        </div>
      </div>
    </div>
  )
}
