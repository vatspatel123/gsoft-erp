interface Props {
  icon: string
  title: string
  subtitle: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon, title, subtitle, actionLabel, onAction }: Props) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '60px 20px',
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>{icon}</div>
      <h3 style={{
        fontSize: '16px',
        fontWeight: 500,
        color: '#1a0a2e',
        marginBottom: '8px',
        margin: '0 0 8px'
      }}>
        {title}
      </h3>
      <p style={{
        fontSize: '13px',
        color: '#94a3b8',
        marginBottom: '20px',
        margin: '0 0 20px'
      }}>
        {subtitle}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          style={{
            background: '#9333ea',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 20px',
            fontSize: '13px',
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif"
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
