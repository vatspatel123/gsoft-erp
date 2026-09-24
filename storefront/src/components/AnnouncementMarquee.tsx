export function AnnouncementMarquee({ text }: { text: string }) {
  if (!text) return null
  return (
    <div style={{ background: 'var(--navy)', color: 'var(--cream)', overflow: 'hidden', whiteSpace: 'nowrap' }}>
      <div style={{ display: 'flex', width: 'max-content', animation: 'marquee 28s linear infinite' }}>
        {[0, 1].map(i => (
          <div key={i} style={{ display: 'flex', gap: 48, padding: '11px 24px', fontSize: 12.5, letterSpacing: '.18em', textTransform: 'uppercase' }}>
            <span>{text}</span><span style={{ color: 'var(--pink)' }}>✦</span>
            <span>{text}</span><span style={{ color: 'var(--pink)' }}>✦</span>
          </div>
        ))}
      </div>
      <style>{`@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  )
}
