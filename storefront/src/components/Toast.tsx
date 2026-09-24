export function Toast({ text }: { text: string | null }) {
  return (
    <div style={{
      position: 'fixed', left: '50%', bottom: 24, zIndex: 80,
      transform: `translateX(-50%) translateY(${text ? '0' : '14px'})`,
      opacity: text ? 1 : 0, transition: 'all .3s', pointerEvents: 'none',
      background: 'var(--navy)', color: 'var(--cream)', padding: '14px 26px', borderRadius: 999,
      fontSize: 13, letterSpacing: '.1em', textTransform: 'uppercase',
      boxShadow: '0 18px 40px rgba(51,59,71,.3)'
    }}>{text || ''}</div>
  )
}
