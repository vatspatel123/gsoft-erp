export function QtyStepper({ qty, onChange }: { qty: number; onChange: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid rgba(51,59,71,.18)', borderRadius: 999, background: '#fff', flex: 'none' }}>
      <button type="button" onClick={() => onChange(qty - 1)} aria-label="Decrease" style={{ width: 44, height: 52, border: 'none', background: 'transparent', fontSize: 19, cursor: 'pointer', borderRadius: '999px 0 0 999px' }}>−</button>
      <span style={{ minWidth: 34, textAlign: 'center', fontSize: 15 }}>{qty}</span>
      <button type="button" onClick={() => onChange(qty + 1)} aria-label="Increase" style={{ width: 44, height: 52, border: 'none', background: 'transparent', fontSize: 19, cursor: 'pointer', borderRadius: '0 999px 999px 0' }}>+</button>
    </div>
  )
}
