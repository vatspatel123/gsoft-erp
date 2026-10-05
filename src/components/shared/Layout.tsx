import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { OfflineBanner } from './OfflineBanner'

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const isPOS = location.pathname === '/' || location.pathname === '/pos'

  // The menu can be tucked away for more room (☰ or Ctrl+B); the choice is kept per PC.
  const [menuHidden, setMenuHidden] = useState(() => { try { return localStorage.getItem('erp_menu_hidden') === '1' } catch { return false } })
  const toggleMenu = () => setMenuHidden(h => { try { localStorage.setItem('erp_menu_hidden', h ? '0' : '1') } catch {} ; return !h })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleMenu() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {!menuHidden && <Sidebar />}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-page)', overflow: 'hidden' }}>
        <Topbar onToggleSidebar={toggleMenu} sidebarHidden={menuHidden} />
        <OfflineBanner />
        <main style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </main>
      </div>

      {/* FAB — quick new sale, hidden on POS page */}
      {!isPOS && (
        <button
          onClick={() => navigate('/')}
          title="New Sale (Ctrl+1)"
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 999,
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: '#9333ea',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(147,51,234,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            transition: 'transform 0.15s'
          }}
        >
          🛒
        </button>
      )}
    </div>
  )
}
