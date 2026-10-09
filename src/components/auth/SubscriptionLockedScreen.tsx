import React from 'react'
import { supabase } from '../../lib/supabase'

export function SubscriptionLockedScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8fafc'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '24px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
        width: '100%',
        maxWidth: '480px',
        textAlign: 'center'
      }}>
        <div style={{
          width: '64px', height: '64px', background: '#fee2e2', color: '#ef4444',
          borderRadius: '50%', display: 'flex', alignItems: 'center',
          justifyContent: 'center', margin: '0 auto 24px'
        }}>
          <svg style={{ width: '32px', height: '32px', strokeWidth: 2, stroke: 'currentColor', fill: 'none' }} viewBox="0 0 24 24">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0110 0v4"></path>
          </svg>
        </div>
        
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', margin: '0 0 12px' }}>
          Subscription Locked
        </h1>
        <p style={{ color: '#64748b', fontSize: '15px', margin: '0 0 32px', lineHeight: 1.5 }}>
          Your store's subscription is past due or has been locked by the administrator. 
          Please renew your license to regain access to Retail ERP.
        </p>

        <button 
          onClick={async () => {
            // Sign out only — keep this PC's printers and unsynced bills (see Sidebar).
            await supabase.auth.signOut()
            window.location.href = '/'
          }}
          style={{
            padding: '12px 24px', background: '#f1f5f9', color: '#475569',
            border: 'none', borderRadius: '12px', fontSize: '14px',
            fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s'
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
