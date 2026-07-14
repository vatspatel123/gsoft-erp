import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { getPendingCount } from '../../utils/offlineCache'
import { useState, useEffect } from 'react'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const [pendingCount, setPendingCount] = useState(getPendingCount())

  useEffect(() => {
    const t = setInterval(() => setPendingCount(getPendingCount()), 3000)
    return () => clearInterval(t)
  }, [])

  if (isOnline) return null

  return (
    <div style={{
      background: '#fff7ed',
      borderBottom: '1px solid #fed7aa',
      padding: '8px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontSize: '13px',
      flexShrink: 0
    }}>
      <style>{`
        @keyframes offline-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: '#f97316',
        flexShrink: 0,
        animation: 'offline-pulse 1s ease-in-out infinite'
      }} />
      <span style={{ color: '#c2410c', fontWeight: 600 }}>No internet connection</span>
      <span style={{ color: '#64748b' }}>
        — Working offline. Bills will sync when internet returns.
      </span>
      {pendingCount > 0 && (
        <span style={{
          background: '#ef4444',
          color: 'white',
          borderRadius: '99px',
          padding: '2px 8px',
          fontSize: '11px',
          fontWeight: 700,
          flexShrink: 0
        }}>
          {pendingCount} pending
        </span>
      )}
    </div>
  )
}
