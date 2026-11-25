/**
 * "Dami" - the DAMS owl. One drawing, several poses, always the same purple-and-white owl
 * with big expressive eyes and a paper accessory.
 *
 * poses: idle | wave (welcome) | read (loading) | celebrate | confused | approved | empty | error
 */
const POSES = {
  idle:      { eyes: 'open',  brow: 'none',     wingL: 0,   wingR: 0,   item: 'none' },
  wave:      { eyes: 'open',  brow: 'none',     wingL: 8,   wingR: -55, item: 'doc',   anim: 'wave' },
  read:      { eyes: 'down',  brow: 'none',     wingL: -22, wingR: 22,  item: 'paper' },
  celebrate: { eyes: 'happy', brow: 'none',     wingL: 62,  wingR: -62, item: 'confetti', hop: true },
  confused:  { eyes: 'side',  brow: 'confused', wingL: 0,   wingR: -35, item: 'question', tilt: -6 },
  approved:  { eyes: 'happy', brow: 'none',     wingL: 0,   wingR: -28, item: 'stamp' },
  empty:     { eyes: 'open',  brow: 'none',     wingL: 6,   wingR: -6,  item: 'blank' },
  error:     { eyes: 'wide',  brow: 'worried',  wingL: 10,  wingR: -10, item: 'alert' },
}

const BODY = '#6D28D9'
const DARK = '#4C1D95'
const WING = '#5B21B6'
const BELLY = '#EDE9FE'

function Eyes({ mode }) {
  const pupil = { open: [0, 0, 10], down: [0, 9, 10], side: [8, -3, 10], wide: [0, 0, 13], happy: null }[mode]
  return [76, 124].map((cx) => (
    <g key={cx}>
      <circle cx={cx} cy="84" r="25" fill="#fff" stroke={DARK} strokeWidth="2.5" />
      {pupil ? (
        <g className={mode === 'open' ? 'owl-blink' : mode === 'down' ? 'owl-read' : ''}>
          <circle cx={cx + pupil[0]} cy={84 + pupil[1]} r={pupil[2]} fill="#0F172A" />
          <circle cx={cx + pupil[0] + 3.5} cy={84 + pupil[1] - 4} r="3.2" fill="#fff" />
        </g>
      ) : (
        <path d={`M${cx - 14} 88 Q${cx} 68 ${cx + 14} 88`} fill="none" stroke="#0F172A" strokeWidth="4.5" strokeLinecap="round" />
      )}
    </g>
  ))
}

function Brows({ mode }) {
  if (mode === 'none') return null
  const d = mode === 'confused'
    ? ['M54 52 L92 58', 'M108 50 L146 42']
    : ['M54 60 L92 50', 'M108 50 L146 60']
  return d.map((path) => <path key={path} d={path} stroke={DARK} strokeWidth="5" strokeLinecap="round" fill="none" />)
}

function Item({ type }) {
  switch (type) {
    case 'doc': // welcome: holding a document
      return (
        <g>
          <rect x="70" y="118" width="60" height="62" rx="4" fill="#fff" stroke="#C4B5FD" strokeWidth="2" />
          <path d="M114 118 L130 134 H118 a4 4 0 0 1 -4 -4Z" fill="#DDD6FE" />
          {[134, 146, 158, 168].map((y, i) => <rect key={y} x="78" y={y} width={i === 3 ? 22 : 38} height="4" rx="2" fill="#C4B5FD" />)}
        </g>
      )
    case 'paper': // loader: reading a sheet
      return (
        <g>
          <rect x="62" y="112" width="76" height="70" rx="4" fill="#fff" stroke="#C4B5FD" strokeWidth="2" />
          {[126, 138, 150, 162].map((y) => <rect key={y} x="72" y={y} width="56" height="4" rx="2" fill="#DDD6FE" />)}
        </g>
      )
    case 'blank': // empty state: a blank page with a dashed outline
      return (
        <g>
          <rect x="72" y="120" width="56" height="60" rx="4" fill="#fff" stroke="#A78BFA" strokeWidth="2" strokeDasharray="5 4" />
          <path d="M100 138 V162 M88 150 H112" stroke="#A78BFA" strokeWidth="3" strokeLinecap="round" />
        </g>
      )
    case 'stamp':
      return (
        <g>
          <g className="owl-stamp">
            <rect x="46" y="128" width="108" height="34" rx="6" fill="#fff" fillOpacity=".92" stroke="#16A34A" strokeWidth="3.5" />
            <text x="100" y="152" textAnchor="middle" fontSize="19" fontWeight="800" fill="#16A34A" letterSpacing="1.5" fontFamily="Inter, Arial, sans-serif">APPROVED</text>
          </g>
          <rect x="146" y="76" width="14" height="30" rx="6" fill="#F59E0B" />
          <rect x="138" y="102" width="30" height="9" rx="3" fill="#D97706" />
        </g>
      )
    case 'confetti':
      return (
        <g className="owl-confetti">
          {[[28, 40, '#F59E0B'], [170, 34, '#22C55E'], [44, 18, '#EC4899'], [156, 14, '#38BDF8'], [100, 8, '#F59E0B'], [18, 76, '#A78BFA'], [184, 72, '#F472B6']].map(([x, y, c], i) => (
            i % 2 ? <rect key={i} x={x} y={y} width="9" height="9" rx="2" fill={c} transform={`rotate(25 ${x} ${y})`} /> : <circle key={i} cx={x} cy={y} r="5" fill={c} />
          ))}
        </g>
      )
    case 'question':
      return <text className="owl-wobble" x="150" y="44" fontSize="40" fontWeight="800" fill="#7C3AED" fontFamily="Inter, Arial, sans-serif">?</text>
    case 'alert':
      return (
        <g>
          <path d="M160 18 L182 56 H138Z" fill="#F59E0B" stroke="#B45309" strokeWidth="2" strokeLinejoin="round" />
          <rect x="158.5" y="29" width="3" height="14" rx="1.5" fill="#fff" />
          <circle cx="160" cy="49" r="2" fill="#fff" />
        </g>
      )
    default:
      return null
  }
}

export default function Owl({ pose = 'idle', size = 140, className = '', animated = true, label }) {
  const p = POSES[pose] || POSES.idle
  const wing = (deg, origin) => ({ transform: `rotate(${deg}deg)`, transformOrigin: origin })
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" className={className} role="img" aria-label={label || `DAMS owl, ${pose}`}>
      <g className={animated && p.hop ? 'owl-hop' : animated && pose === 'idle' ? 'owl-bob' : ''}>
        <g style={p.tilt ? { transform: `rotate(${p.tilt}deg)`, transformOrigin: '100px 150px' } : undefined}>
          {/* ear tufts, body, belly */}
          <path d="M50 46 L80 68 L48 84Z" fill={DARK} />
          <path d="M150 46 L120 68 L152 84Z" fill={DARK} />
          <ellipse cx="100" cy="118" rx="60" ry="64" fill={BODY} />
          <ellipse cx="100" cy="140" rx="38" ry="42" fill={BELLY} />
          {[128, 142, 156].map((y) => <path key={y} d={`M80 ${y} q10 8 20 0 q10 8 20 0`} stroke="#C4B5FD" strokeWidth="2.5" fill="none" strokeLinecap="round" />)}
          {/* feet */}
          <ellipse cx="84" cy="183" rx="12" ry="4.5" fill="#F59E0B" />
          <ellipse cx="116" cy="183" rx="12" ry="4.5" fill="#F59E0B" />
          {/* face */}
          <Eyes mode={p.eyes} />
          <Brows mode={p.brow} />
          <path d="M93 97 H107 L100 113Z" fill="#F59E0B" stroke="#D97706" strokeWidth="1.5" strokeLinejoin="round" />
        </g>
        {/* held item sits under the wings so they look like they hold it */}
        <Item type={p.item} />
        <g className={animated && p.anim === 'wave' ? 'owl-wave' : ''} style={{ transformBox: 'fill-box', transformOrigin: '20% 10%' }}>
          <path className="owl-part" style={wing(p.wingR, '20% 10%')} d="M150 100 C176 108 178 152 154 164 C142 152 138 122 150 100Z" fill={WING} />
        </g>
        <path className="owl-part" style={wing(p.wingL, '80% 10%')} d="M50 100 C24 108 22 152 46 164 C58 152 62 122 50 100Z" fill={WING} />
      </g>
    </svg>
  )
}
