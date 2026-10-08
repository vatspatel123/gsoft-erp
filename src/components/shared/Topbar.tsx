import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { getPendingCount } from '../../utils/offlineCache';
import toast from 'react-hot-toast';

const pageNames: Record<string, string> = {
  '/':                'POS Billing',
  '/dashboard':       'Dashboard',
  '/pos':             'POS Billing',
  '/products':        'Products',
  '/inventory':       'Inventory',
  '/stock-damage':    'Stock Damage',
  '/invoices':        'Invoices',
  '/crm':             'Customers',
  '/suppliers':       'Suppliers',
  '/accounting':      'Accounting',
  '/reports':         'Reports',
  '/exchange':        'Exchange / Return',
  '/wholesale':       'Wholesale',
  '/wholesale-bills': 'Wholesale Bills',
  '/purchase-entry':  'Purchase Entry',
  '/purchase-bills':  'Purchase Bills',
  '/purchase-returns':'Purchase Returns',
  '/staff':           'Staff',
  '/settings':        'Settings',
  '/expenses':        'Expenses',
  '/formats':         'Bill & Label Designer',
  '/online-listings': 'Website Listings',
  '/online-orders':   'Online Orders',
  '/website-settings':'Website CMS',
};

export function Topbar({ onToggleSidebar, sidebarHidden }: { onToggleSidebar?: () => void; sidebarHidden?: boolean }) {
  const [time, setTime] = useState(new Date());
  const [pendingCount, setPendingCount] = useState(getPendingCount());
  const isOnline = useOnlineStatus();
  const location = useLocation();

  const currentPage = pageNames[location.pathname] || 'Dashboard';

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
      setPendingCount(getPendingCount());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header style={{
      height: '56px',
      backgroundColor: '#ffffff',
      color: '#1a0a2e',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      borderBottom: '1px solid #f3e8ff',
      boxShadow: '0 1px 4px rgba(147,51,234,0.06)',
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 500, fontSize: '15px', color: '#1a0a2e' }}>
        {onToggleSidebar && (
          <button onClick={onToggleSidebar} title={`${sidebarHidden ? 'Show' : 'Hide'} menu (Ctrl+B)`} aria-label="Toggle menu"
            style={{ border: '1px solid #f3e8ff', background: sidebarHidden ? '#f3e8ff' : 'white', color: '#7c3aed',
                     borderRadius: '8px', width: '34px', height: '32px', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>
            ☰
          </button>
        )}
        {currentPage}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 12px',
          borderRadius: '20px',
          backgroundColor: isOnline ? '#f0fdf4' : '#fff7ed',
          border: `1px solid ${isOnline ? '#bbf7d0' : '#fed7aa'}`
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isOnline ? '#16a34a' : '#f97316',
            animation: isOnline ? 'none' : 'pulse 2s infinite'
          }} />
          <span style={{ 
            fontSize: '12px', 
            color: isOnline ? '#16a34a' : '#f97316',
            fontWeight: 500
          }}>
            {isOnline ? 'Online' : 'Offline Mode'}
          </span>
        </div>
        {pendingCount > 0 && (
          <button
            onClick={async () => {
              if ((window as any).syncPendingSales) {
                toast.loading('Attempting cloud sync...', { id: 'manual-sync' })
                await (window as any).syncPendingSales()
                setPendingCount(getPendingCount())
                if (getPendingCount() === 0) {
                  toast.success('All sales synced to cloud! ✅', { id: 'manual-sync' })
                } else {
                  toast.success(`${getPendingCount()} bills saved safely in local storage`, { id: 'manual-sync' })
                }
              }
            }}
            title="Click to retry cloud sync for offline bills"
            style={{
              backgroundColor: '#f97316',
              color: 'white',
              border: 'none',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            ☁️ {pendingCount} Local Bill{pendingCount > 1 ? 's' : ''} (Sync)
          </button>
        )}
        <div style={{
          backgroundColor: '#f5f3ff',
          color: '#9333ea',
          border: '1px solid #e9d5ff',
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 500
        }}>
          Counter 1
        </div>
        <div style={{ fontSize: '12px', fontFamily: "'DM Mono', monospace", color: '#94a3b8' }}>
          {time.toLocaleTimeString()}
        </div>
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </header>
  );
}
