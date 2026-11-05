import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart,
  Package, Boxes, XOctagon,
  FileText, Users, ArrowLeftRight,
  Truck,
  BookOpen, PieChart, Settings, Store, PenTool,
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
      { to: '/wholesale-bills', label: 'Wholesale Bills & Parties', icon: FileText },
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
      { to: '/purchase-entry', label: 'Purchase Entry & Bills', icon: ShoppingBag },
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
      { to: '/formats', label: 'Bill & Label Designer', icon: PenTool, badge: 'New', badgeColor: '#dc2626' },
    ]
  }
];

export function Sidebar() {
  return (
    <aside style={{
      width: '240px',
      backgroundColor: '#ffffff',
      color: '#3f3f4e',
      borderRight: '1px solid #e5e5ea',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif",
      overflowY: 'auto'
    }}>
      <div style={{ 
        padding: '24px 20px', 
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        borderBottom: '1px solid #e5e5ea' 
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          backgroundColor: '#9333ea',
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
          <div style={{ color: '#1c1c28', fontSize: '14px', fontWeight: 600, lineHeight: 1 }}>Retail ERP</div>
          <div style={{ color: '#6b6b7b', fontSize: '11px', marginTop: '4px', lineHeight: 1 }}>General Edition</div>
        </div>
      </div>
      
      <nav style={{ flex: 1, padding: '16px 12px' }}>
        {SECTIONS.map((section, idx) => (
          <div key={idx} style={{ marginBottom: '20px' }}>
            <div style={{ 
              fontSize: '9px', 
              fontWeight: 600, 
              color: '#6b6b7b', 
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
                  color: isActive ? '#6b21a8' : '#3f3f4e',
                  backgroundColor: isActive ? '#f5f3ff' : 'transparent',
                  fontWeight: isActive ? 600 : 400,
                  borderRadius: '8px',
                  gap: '9px',
                  marginBottom: '4px',
                  fontSize: '13px'
                })}
              >
                <link.icon style={{ width: '16px', height: '16px', strokeWidth: 2, stroke: 'currentColor' }} />
                <span style={{ flex: 1 }}>{link.label}</span>
                
                {link.shortcut && !link.badge && (
                  <span style={{ fontSize: '10px', color: '#8a8a99' }}>
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

      <div style={{ padding: '8px 12px', borderTop: '1px solid #e5e5ea' }}>
        <NavLink
          to="/settings"
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', padding: '0 12px',
            height: '40px', textDecoration: 'none',
            color: isActive ? '#6b21a8' : '#3f3f4e',
            backgroundColor: isActive ? '#f5f3ff' : 'transparent',
            fontWeight: isActive ? 600 : 400,
            borderRadius: '8px', gap: '9px', fontSize: '13px'
          })}
        >
          <Settings style={{ width: '16px', height: '16px', strokeWidth: 2, stroke: 'currentColor' }} />
          <span>Settings</span>
        </NavLink>
        <button
          onClick={async () => {
            if (confirm('Are you sure you want to log out?')) {
              // Sign out only. Clearing storage here wiped this PC's printers and
              // label setup (so every log-in started with "set up the printer
              // again"), and any bills billed offline that hadn't synced yet.
              const { supabase } = await import('../../lib/supabase')
              await supabase.auth.signOut()
              window.location.href = '/'
            }
          }}
          style={{
            display: 'flex', alignItems: 'center', padding: '0 12px', marginTop: '4px',
            height: '40px', textDecoration: 'none', border: 'none', width: '100%',
            color: '#3f3f4e', backgroundColor: 'transparent', cursor: 'pointer',
            fontWeight: 400, borderRadius: '8px', gap: '9px', fontSize: '13px'
          }}
          onMouseOver={e => { e.currentTarget.style.backgroundColor = '#f6f6f8' }}
          onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
        >
          <svg style={{ width: '16px', height: '16px', strokeWidth: 2, stroke: 'currentColor', fill: 'none' }} viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  );
}
