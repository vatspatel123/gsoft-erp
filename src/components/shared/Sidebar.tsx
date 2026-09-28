import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart,
  Package, Boxes, XOctagon,
  FileText, Users, ArrowLeftRight,
  Truck,
  BookOpen, PieChart, Settings, Store,
  ShoppingBag, Receipt, RotateCcw,
  type LucideIcon
} from 'lucide-react';

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: string;
  badgeColor?: string;
  shortcut?: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const SECTIONS: NavSection[] = [
  {
    title: 'Main',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, shortcut: '⌃2' },
      { to: '/', label: 'POS Billing', icon: ShoppingCart, exact: true, badge: 'Live', badgeColor: '#ef4444', shortcut: '⌃1' },
      { to: '/wholesale', label: 'Wholesale', icon: Store, badge: 'B2B', badgeColor: '#1d4ed8' },
    ]
  },
  {
    title: 'Inventory',
    items: [
      { to: '/products', label: 'Products', icon: Package, shortcut: '⌃3' },
      { to: '/inventory', label: 'Inventory', icon: Boxes, badge: 'AI', badgeColor: '#8b5cf6' },
      { to: '/stock-damage', label: 'Stock Damage', icon: XOctagon },
    ]
  },
  {
    title: 'Sales & CRM',
    items: [
      { to: '/invoices', label: 'Invoices', icon: FileText },
      { to: '/exchange', label: 'Exchange / Return', icon: ArrowLeftRight },
      { to: '/crm', label: 'Customers', icon: Users, badge: 'AI', badgeColor: '#8b5cf6' },
      { to: '/staff', label: 'Staff', icon: Users }
    ]
  },
  {
    title: 'Procurement',
    items: [
      { to: '/suppliers', label: 'Suppliers', icon: Truck },
      { to: '/purchase-entry', label: 'Purchase Entry', icon: ShoppingBag },
      { to: '/purchase-bills', label: 'Purchase Bills', icon: FileText },
      { to: '/purchase-returns', label: 'Purchase Returns', icon: RotateCcw, badge: 'New', badgeColor: '#dc2626' },
    ]
  },
  {
    title: 'Online Store',
    items: [
      { to: '/online-listings', label: 'Website Listings', icon: Store, badge: 'Sync', badgeColor: '#9333ea' },
      { to: '/online-orders', label: 'Online Orders', icon: ShoppingBag, badge: 'Live', badgeColor: '#10b981' },
      { to: '/website-settings', label: 'Website CMS', icon: Settings },
    ]
  },
  {
    title: 'Finance',
    items: [
      { to: '/accounting', label: 'Accounting', icon: BookOpen },
      { to: '/expenses', label: 'Expenses', icon: Receipt },
      { to: '/reports', label: 'Reports', icon: PieChart, badge: 'AI', badgeColor: '#8b5cf6' },
    ]
  }
];

export function Sidebar() {
  return (
    <aside style={{
      width: '240px',
      backgroundColor: 'var(--bg-sidebar)',
      color: 'var(--text-sidebar)',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'DM Sans', sans-serif",
      overflowY: 'auto'
    }}>
      <div style={{ 
        padding: '24px 20px', 
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        borderBottom: '1px solid rgba(255,255,255,0.05)' 
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          backgroundColor: '#c084fc',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          fontSize: '16px'
        }}>
          R
        </div>
        <div>
          <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600, lineHeight: 1 }}>Retail ERP</div>
          <div style={{ color: '#c4b5d4', fontSize: '10px', marginTop: '4px', lineHeight: 1 }}>General Edition</div>
        </div>
      </div>
      
      <nav style={{ flex: 1, padding: '16px 12px' }}>
        {SECTIONS.map((section, idx) => (
          <div key={idx} style={{ marginBottom: '20px' }}>
            <div style={{ 
              fontSize: '9px', 
              fontWeight: 600, 
              color: '#9b7db8', 
              textTransform: 'uppercase', 
              letterSpacing: '0.1em',
              padding: '12px 12px 4px',
            }}>
              {section.title}
            </div>
            {section.items.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.exact}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  height: '40px',
                  textDecoration: 'none',
                  color: isActive ? '#ffffff' : '#c4b5d4',
                  backgroundColor: isActive ? '#c084fc' : 'transparent',
                  fontWeight: isActive ? 500 : 400,
                  borderRadius: '8px',
                  gap: '9px',
                  marginBottom: '4px',
                  fontSize: '13px',
                  transition: 'background-color 0.15s, color 0.15s'
                })}
              >
                <link.icon style={{ width: '16px', height: '16px', strokeWidth: 2, stroke: 'currentColor' }} />
                <span style={{ flex: 1 }}>{link.label}</span>
                
                {link.shortcut && !link.badge && (
                  <span style={{ fontSize: '10px', color: 'rgba(196,181,212,0.5)', fontFamily: "'DM Mono', monospace" }}>
                    {link.shortcut}
                  </span>
                )}
                {link.badge && (
                  <span style={{
                    backgroundColor: link.badgeColor,
                    color: '#fff',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '10px',
                  }}>
                    {link.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <NavLink
          to="/settings"
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', padding: '0 12px',
            height: '40px', textDecoration: 'none',
            color: isActive ? '#ffffff' : '#c4b5d4',
            backgroundColor: isActive ? '#c084fc' : 'transparent',
            fontWeight: isActive ? 500 : 400,
            borderRadius: '8px', gap: '9px', fontSize: '13px',
            transition: 'background-color 0.15s, color 0.15s'
          })}
        >
          <Settings style={{ width: '16px', height: '16px', strokeWidth: 2, stroke: 'currentColor' }} />
          <span>Settings</span>
        </NavLink>
        <button
          onClick={async () => {
            if (confirm('Are you sure you want to log out? Offline data may be cleared.')) {
              localStorage.clear()
              const { supabase } = await import('../../lib/supabase')
              await supabase.auth.signOut()
              window.location.href = '/'
            }
          }}
          style={{
            display: 'flex', alignItems: 'center', padding: '0 12px', marginTop: '4px',
            height: '40px', textDecoration: 'none', border: 'none', width: '100%',
            color: '#c4b5d4', backgroundColor: 'transparent', cursor: 'pointer',
            fontWeight: 400, borderRadius: '8px', gap: '9px', fontSize: '13px',
            transition: 'background-color 0.15s, color 0.15s'
          }}
          onMouseOver={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)' }}
          onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
        >
          <svg style={{ width: '16px', height: '16px', strokeWidth: 2, stroke: 'currentColor', fill: 'none' }} viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  );
}
