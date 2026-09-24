import { useState } from 'react'

export function Accordion({ items }: { items: { title: string; body: string }[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0)
  return (
    <div style={{ marginTop: 26, borderTop: '1px solid rgba(51,59,71,.1)' }}>
      {items.map((item, i) => (
        <div key={item.title} style={{ borderBottom: '1px solid rgba(51,59,71,.1)' }}>
          <button
            type="button"
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            style={{
              width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              border: 'none', background: 'transparent', fontSize: 14, letterSpacing: '.06em',
              textTransform: 'uppercase', padding: '16px 0', cursor: 'pointer', color: 'var(--navy)'
            }}
          >
            <span>{item.title}</span>
            <span style={{ color: 'var(--pink)', fontSize: 17 }}>{openIdx === i ? '−' : '+'}</span>
          </button>
          {openIdx === i && (
            <div style={{ fontSize: 14, fontWeight: 300, lineHeight: 1.75, color: 'rgba(51,59,71,.72)', padding: '0 0 18px', maxWidth: '52ch' }}>
              {item.body}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
