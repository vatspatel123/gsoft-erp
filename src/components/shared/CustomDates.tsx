const box = { padding: '6px 8px', border: '1px solid #e9d5ff', borderRadius: '8px', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: '#1a0a2e', background: 'white' } as const

/** From – To date boxes for a "Custom" range. Dates are yyyy-mm-dd; From can't pass To. */
export function CustomDates({ from, to, max, onFrom, onTo }: {
  from: string; to: string; max?: string; onFrom: (d: string) => void; onTo: (d: string) => void
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
      From
      <input type="date" value={from} max={to || max} onChange={e => e.target.value && onFrom(e.target.value)} style={box} />
      To
      <input type="date" value={to} min={from} max={max} onChange={e => e.target.value && onTo(e.target.value)} style={box} />
    </span>
  )
}
