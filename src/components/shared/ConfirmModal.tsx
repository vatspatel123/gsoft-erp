interface Props {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  confirmColor?: 'red' | 'purple'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmColor = 'red',
  onConfirm,
  onCancel
}: Props) {
  if (!isOpen) return null

  const confirmBg = confirmColor === 'red' ? '#ef4444' : '#9333ea'

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        fontFamily: "'DM Sans', sans-serif"
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '16px',
          padding: '28px',
          maxWidth: '360px',
          width: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
        }}
      >
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: confirmColor === 'red' ? '#fef2f2' : '#f5f3ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '22px',
          margin: '0 auto 16px'
        }}>
          {confirmColor === 'red' ? '🗑️' : '⚠️'}
        </div>

        <h3 style={{
          fontSize: '16px',
          fontWeight: 600,
          color: '#1a0a2e',
          textAlign: 'center',
          margin: '0 0 8px'
        }}>
          {title}
        </h3>
        <p style={{
          fontSize: '13px',
          color: '#64748b',
          textAlign: 'center',
          margin: '0 0 24px',
          lineHeight: 1.5
        }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '11px',
              background: 'white',
              color: '#64748b',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              fontSize: '14px',
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif"
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '11px',
              background: confirmBg,
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif"
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
