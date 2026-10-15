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

  // Online, but bills the server has not taken yet: this is the dangerous case (it looks
  // like everything is fine), so it is never silent. They are retried every 2 minutes.
  if (isOnline && pendingCount > 0) {
    return (
      <div style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ color: '#b91c1c', fontWeight: 700 }}>⚠️ {pendingCount} bill{pendingCount > 1 ? 's are' : ' is'} saved only on this PC — NOT on the server yet</span>
        <span style={{ color: '#64748b' }}>They appear in Invoices as INV-L… / OFF-… and are sent again automatically. Do not clear data.</span>
        <button onClick={() => { void (window as any).syncPendingSales?.() }}
          style={{ marginLeft: 'auto', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', padding: '5px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
          Send now
        </button>
      </div>
    )
  }

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
