import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect, useState } from 'react'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { useNotifications } from './hooks/useNotifications'
import { saveProductsToCache, saveSalesmenToCache, getPendingSales, clearPendingSale } from './utils/offlineCache'
import { supabase } from './lib/supabase'
import toast from 'react-hot-toast'
import { SplashScreen } from './components/shared/SplashScreen'
import { DashboardPage } from './pages/DashboardPage'
import { POSPage } from './pages/POSPage'
import { InventoryPage } from './pages/InventoryPage'
import { ProductsPage } from './pages/ProductsPage'
import { StockDamagePage } from './pages/StockDamagePage'
import { CustomersPage } from './pages/CustomersPage'
import { InvoicesPage } from './pages/InvoicesPage'
import { SuppliersPage } from './pages/SuppliersPage'
import { PurchaseOrdersPage } from './pages/PurchaseOrdersPage'
import { InwardChallansPage } from './pages/InwardChallansPage'
import { AccountingPage } from './pages/AccountingPage'
import ReportsPage from './pages/ReportsPage'
import { StaffPage } from './pages/StaffPage'
import { SettingsPage } from './pages/SettingsPage'
import { ExchangePage } from './pages/ExchangePage'
import { WholesalePage } from './pages/WholesalePage'
import { PurchaseEntryPage } from './pages/PurchaseEntryPage'
import { ExpensesPage } from './pages/ExpensesPage'

// Inner component so useNavigate works (must be inside BrowserRouter)
function AppContent() {
  const navigate = useNavigate()
  const isOnline = useOnlineStatus()
  const [showSplash, setShowSplash] = useState(true)

  // Splash screen — 2 seconds
  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 2000)
    return () => clearTimeout(t)
  }, [])

  // Smart notifications (low stock, birthdays, credit sales)
  useNotifications()

  // Pre-cache data for offline use
  useEffect(() => {
    const preCache = async () => {
      if (!navigator.onLine) return
      try {
        const [p, s, c] = await Promise.all([
          supabase.from('products').select('*').eq('is_active', true),
          supabase.from('users').select('id, name, role').eq('is_active', true),
          supabase.from('customers').select('*')
        ])
        if (p.data) saveProductsToCache(p.data)
        if (s.data) saveSalesmenToCache(s.data)
        if (c.data && c.data.length >= 0) {
          localStorage.setItem('gsoft_customers_cache', JSON.stringify({
            data: c.data,
            savedAt: Date.now()
          }))
        }
      } catch (e) {
        console.error('Cache error:', e)
      }
    }
    preCache()
  }, [])

  // Sync pending offline sales when back online
  useEffect(() => {
    if (!isOnline) return
    const pending = getPendingSales()
    if (pending.length === 0) return
    const sync = async () => {
      let synced = 0
      for (const sale of pending) {
        try {
          const { data } = await supabase
            .from('sales')
            .insert({
              invoice_no: sale.invoiceNo,
              customer_id: sale.customer?.id || null,
              counter_id: sale.counterId,
              salesman_id: sale.salesmanId || null,
              total_amount: sale.subtotal,
              discount_amount: sale.totalDiscount || 0,
              net_amount: sale.netAmount,
              gst_amount: sale.gstAmount,
              payment_mode: sale.paymentMode,
              is_return: false
            })
            .select()
            .single()
          if (data) {
            await supabase.from('sale_items').insert(
              sale.cart.map((i: any) => ({
                sale_id: data.id,
                product_id: i.product.id,
                qty: i.qty,
                unit_price: i.unit_price,
                discount_pct: i.discount_pct || 0,
                gst_rate: i.product.gst_rate,
                line_total: i.line_total
              }))
            )
            clearPendingSale(sale.pendingId)
            synced++
          }
        } catch (e) {
          console.error('Sync error:', e)
        }
      }
      if (synced > 0) toast.success(`${synced} offline bill${synced > 1 ? 's' : ''} synced to cloud!`)
    }
    sync()
  }, [isOnline])

  // Auto-updater notifications
  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.onUpdateAvailable(() => {
      toast('Update downloading...', { icon: '⬇️', duration: 3000 })
    })
    window.electronAPI.onUpdateDownloaded(() => {
      toast(
        (t) => (
          <div>
            <div style={{ fontWeight: 500, marginBottom: '8px' }}>Update ready to install!</div>
            <button
              onClick={() => window.electronAPI?.restartApp()}
              style={{ background: '#9333ea', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px' }}
            >
              Restart & Update
            </button>
          </div>
        ),
        { duration: Infinity }
      )
    })
  }, [])

  // Keyboard shortcuts: Ctrl+1..7
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      switch (e.key) {
        case '1': e.preventDefault(); navigate('/'); break
        case '2': e.preventDefault(); navigate('/dashboard'); break
        case '3': e.preventDefault(); navigate('/products'); break
        case '4': e.preventDefault(); navigate('/inventory'); break
        case '5': e.preventDefault(); navigate('/crm'); break
        case '6': e.preventDefault(); navigate('/invoices'); break
        case '7': e.preventDefault(); navigate('/reports'); break
      }
    }
    window.addEventListener('keydown', handleKeyboard)
    return () => window.removeEventListener('keydown', handleKeyboard)
  }, [navigate])

  if (showSplash) return <SplashScreen />

  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<POSPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/pos" element={<POSPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/stock-damage" element={<StockDamagePage />} />
        <Route path="/crm" element={<CustomersPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="/inward-challans" element={<InwardChallansPage />} />
        <Route path="/accounting" element={<AccountingPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/exchange" element={<ExchangePage />} />
        <Route path="/wholesale" element={<WholesalePage />} />
        <Route path="/purchase-entry" element={<PurchaseEntryPage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}
