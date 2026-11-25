import { useEffect, useRef, useState } from 'react'
import { tint } from '../lib/format'

const ALIGN = { left: 'left', center: 'center', right: 'right', justify: 'justify' }

/** Make "[Field label]" gaps visible so the user can see what is still missing. */
function withGaps(text) {
  return String(text ?? '').split(/(\[[^\]\n]{1,60}\])/g).map((part, i) =>
    /^\[[^\]\n]{1,60}\]$/.test(part) ? <span key={i} className="gap">{part}</span> : part)
}

function Block({ b, accent }) {
  const align = { textAlign: ALIGN[b.align] || 'left' }
  switch (b.t) {
    case 'seal':
      return <div style={{ textAlign: 'center', marginBottom: 6 }}>
        <svg width="54" height="54" viewBox="0 0 54 54" aria-hidden="true">
          <circle cx="27" cy="27" r="24" fill="none" stroke={accent} strokeWidth="2" />
          <circle cx="27" cy="27" r="18" fill={tint(accent, 0.88)} stroke={accent} strokeWidth="1" />
          <path d="m18 28 6 6 12-13" fill="none" stroke={accent} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    case 'org':
      return <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <div className="serif" style={{ fontSize: 22, fontWeight: 700, color: accent, letterSpacing: .3 }}>{withGaps(b.name)}</div>
        {b.tagline && <div style={{ fontSize: 12, color: '#6B7280' }}>{b.tagline}</div>}
      </div>
    case 'rule':
      return <hr style={{ border: 0, borderTop: `2px solid ${accent}`, margin: '10px 0 16px' }} />
    case 'spacer':
      return <div style={{ height: b.h || 12 }} />
    case 'title':
      return <h2 className={b.size === 'xl' ? 'serif' : ''} style={{ ...align, fontSize: b.size === 'xl' ? 38 : 21, fontWeight: 700, letterSpacing: b.size === 'xl' ? 3 : 1.2, margin: '10px 0 12px', color: b.size === 'xl' ? accent : '#111827' }}>{withGaps(b.text)}</h2>
    case 'subtitle':
      return <p style={{ textAlign: 'center', fontSize: 20, fontWeight: 600, margin: '4px 0 14px', color: accent }}>{withGaps(b.text)}</p>
    case 'recipient':
      return <div className="serif" style={{ textAlign: 'center', fontSize: 34, fontStyle: 'italic', fontWeight: 700, margin: '8px 0 14px', padding: '0 24px 6px', borderBottom: `2px solid ${accent}`, display: 'inline-block', minWidth: '55%' }}>{withGaps(b.text)}</div>
    case 'meta':
      return <div style={{ textAlign: ALIGN[b.align] || 'right', margin: '0 0 12px', fontSize: 13 }}>
        {b.rows.map(([k, v], i) => <div key={i}><span style={{ color: '#6B7280' }}>{k}: </span>{withGaps(v)}</div>)}
      </div>
    case 'lines':
      return <div style={{ margin: '0 0 12px' }}>{b.lines.map((l, i) => <div key={i}>{withGaps(l)}</div>)}</div>
    case 'p':
      return <p style={{ ...align, margin: '0 0 10px', fontWeight: b.bold ? 700 : 400, color: b.muted ? '#6B7280' : undefined, whiteSpace: 'pre-wrap' }}>{withGaps(b.text)}</p>
    case 'heading':
      return b.style === 'bar'
        ? <h3 style={{ background: accent, color: '#fff', padding: '4px 10px', fontSize: 14, fontWeight: 700, margin: '14px 0 8px', borderRadius: 3 }}>{b.text}</h3>
        : <h3 style={{ color: accent, fontSize: 15, fontWeight: 700, margin: '14px 0 6px', borderBottom: `1px solid ${tint(accent, 0.6)}`, paddingBottom: 2 }}>{b.text}</h3>
    case 'kv':
      return <table style={{ width: '100%', borderCollapse: 'collapse', margin: '0 0 12px', fontSize: 13.5, ...(b.style === 'box' ? { background: tint(accent, 0.93), borderRadius: 6 } : {}) }}>
        <tbody>{b.rows.map(([k, v], i) => (
          <tr key={i} style={b.style === 'memo' ? {} : { borderBottom: '1px solid #E5E7EB' }}>
            <td style={{ width: '30%', padding: '5px 8px', fontWeight: 700, verticalAlign: 'top' }}>{k}</td>
            <td style={{ padding: '5px 8px', whiteSpace: 'pre-wrap' }}>{withGaps(v)}</td>
          </tr>))}
        </tbody>
      </table>
    case 'list': {
      const Tag = b.ordered ? 'ol' : 'ul'
      return <Tag style={{ margin: '0 0 10px', paddingLeft: 22, listStyle: b.ordered ? 'decimal' : 'disc' }}>{b.items.map((x, i) => <li key={i}>{withGaps(x)}</li>)}</Tag>
    }
    case 'signatures':
      return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, justifyContent: b.items.length > 1 ? 'space-between' : 'flex-start', marginTop: 24 }}>
        {b.items.map((s, i) => (
          <div key={i} style={{ minWidth: 190 }}>
            {s.label && <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 26 }}>{s.label}</div>}
            <div style={{ borderTop: '1px solid #111827', paddingTop: 3, fontWeight: 700 }}>{withGaps(s.name)}</div>
            {s.title && <div style={{ fontSize: 13, color: '#4B5563' }}>{withGaps(s.title)}</div>}
          </div>))}
      </div>
    default:
      return null
  }
}

/**
 * Renders the blocks returned by the backend as a paper page. The same blocks produce the DOCX/PDF
 * downloads, so the preview reflects what will be downloaded (fonts can differ slightly in Word).
 * The page is drawn at real size and scaled down to fit its container.
 */
export default function DocumentPaper({ doc, pending = false, className = '' }) {
  const wrap = useRef(null)
  const [scale, setScale] = useState(0.5)
  const landscape = doc?.orientation === 'landscape'
  const pageW = landscape ? 1123 : 794
  const pageH = landscape ? 794 : 1123

  useEffect(() => {
    if (!wrap.current) return undefined
    const fit = () => setScale(Math.min(1, wrap.current.clientWidth / pageW))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [pageW])

  if (!doc) return null
  const accent = doc.accent || '#6D28D9'
  const centered = doc.layout === 'certificate' || doc.layout === 'announcement'
  return (
    <div ref={wrap} className={`w-full ${className}`}>
      <div style={{ width: pageW * scale, height: pageH * scale, margin: '0 auto' }}>
        <div className={`paper ${landscape ? 'paper-landscape' : 'paper-portrait'} ${pending ? 'paper-pending' : ''}`}
          style={{ transform: `scale(${scale})`, transformOrigin: 'top left', height: pageH, overflow: 'hidden' }}>
          {doc.frame !== 'none' && (
            <div className="frame" style={{ inset: 22, border: `${doc.frame === 'classic' ? '6px double' : '3px solid'} ${accent}`, borderRadius: doc.frame === 'classic' ? 0 : 6 }} />
          )}
          <div style={centered ? { textAlign: 'center' } : undefined}>
            {doc.blocks.map((b, i) => <Block key={i} b={b} accent={accent} />)}
          </div>
          <div style={{ position: 'absolute', bottom: 28, left: 0, right: 0, textAlign: 'center', fontSize: 11, color: '#9CA3AF' }}>
            {doc.reference_no}
          </div>
        </div>
      </div>
    </div>
  )
}
