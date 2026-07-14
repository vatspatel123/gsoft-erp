export function SplashScreen() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'linear-gradient(135deg, #2d1b4e, #1a0a2e)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <style>{`
        @keyframes splash-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }
        @keyframes fill-bar {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>

      <div style={{
        width: '80px',
        height: '80px',
        background: '#9333ea',
        borderRadius: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '36px',
        fontWeight: 700,
        marginBottom: '20px',
        animation: 'splash-pulse 1.4s ease-in-out infinite'
      }}>
        R
      </div>

      <div style={{ fontSize: '28px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>
        Retail ERP
      </div>
      <div style={{ fontSize: '14px', color: '#c4b5d4', marginBottom: '32px' }}>
        Fashion Edition
      </div>

      <div style={{
        width: '200px',
        height: '3px',
        background: 'rgba(255,255,255,0.15)',
        borderRadius: '2px',
        overflow: 'hidden',
        marginBottom: '12px'
      }}>
        <div style={{
          height: '100%',
          background: '#c084fc',
          borderRadius: '2px',
          animation: 'fill-bar 2s ease-out forwards'
        }} />
      </div>

      <div style={{ fontSize: '12px', color: '#9b7db8' }}>
        Loading your store...
      </div>
    </div>
  )
}
