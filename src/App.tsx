import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect, useState } from 'react'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { useNotifications } from './hooks/useNotifications'
import { saveProductsToCache, saveSalesmenToCache, getPendingSales, clearPendingSale } from './utils/offlineCache'
import { pullShopSettings, getSettings, saveSettings } from './utils/settings'
import { autoAssignPrinters, canSelectPrinters } from './utils/printHTML'
import { enterToNextField } from './utils/enterNavigation'
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
import { AccountingPage } from './pages/AccountingPage'
import ReportsPage from './pages/ReportsPage'
import { StaffPage } from './pages/StaffPage'
import { SettingsPage } from './pages/SettingsPage'
import { ExchangePage } from './pages/ExchangePage'
import { WholesalePage } from './pages/WholesalePage'
import { WholesaleBillsPage } from './pages/WholesaleBillsPage'
import { PurchaseEntryPage } from './pages/PurchaseEntryPage'
import { PurchaseReturnPage } from './pages/PurchaseReturnPage'
import { PurchaseBillsPage } from './pages/PurchaseBillsPage'
import { ExpensesPage } from './pages/ExpensesPage'
import { OnlineListingsPage } from './pages/OnlineListingsPage'
import { OnlineOrdersPage } from './pages/OnlineOrdersPage'
import { WebsiteSettingsPage } from './pages/WebsiteSettingsPage'
import { FormatDesignerPage } from './pages/FormatDesignerPage'
import type { Session } from '@supabase/supabase-js'
import { LoginScreen } from './components/auth/LoginScreen'
import { SubscriptionLockedScreen } from './components/auth/SubscriptionLockedScreen'
// Inner component so useNavigate works (must be inside BrowserRouter)
function AppContent() {
  const navigate = useNavigate()
  const isOnline = useOnlineStatus()
  const [showSplash, setShowSplash] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [authInitialized, setAuthInitialized] = useState(false)
  const [storeStatus, setStoreStatus] = useState<string>('active')

  // A printer choice that went missing (the app was closed by a crash before it
  // reached the disk, or Windows renamed the printer) is found again by model
  // name at start-up, so the shop doesn't have to set printers up again.
  // A printer chosen by hand that still exists is never changed.
  useEffect(() => {
    if (!canSelectPrinters()) return
    const s = getSettings()
    autoAssignPrinters().then(({ patch }) => {
      const changed = (Object.keys(patch) as (keyof typeof patch)[]).filter(k => patch[k] && patch[k] !== s[k])
      if (changed.length) saveSettings(Object.fromEntries(changed.map(k => [k, patch[k]])))
    }).catch(() => {})
  }, [])

  // Auth state listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthInitialized(true)
      if (session) {
        // The shop's bill layout, logo and conditions live with the store, not
        // with the computer, so a fresh install picks them up on first sign-in.
        void pullShopSettings()
        supabase.from('stores').select('subscription_status').single().then(({ data }) => {
          if (data) setStoreStatus(data.subscription_status)
        })
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        void pullShopSettings()
        supabase.from('stores').select('subscription_status').single().then(({ data }) => {
          if (data) setStoreStatus(data.subscription_status)
        })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // A login that can't be renewed (password changed, signed out on another PC).
  // Say so in words the cashier can act on, rather than "JWT expired".
  useEffect(() => {
    const onExpired = () => toast.error('Your login has expired. Please sign out and sign in again — nothing was saved.',
      { id: 'session-expired', duration: 8000 })
    window.addEventListener('erp:session-expired', onExpired)
    return () => window.removeEventListener('erp:session-expired', onExpired)
  }, [])

  // Enter moves to the next field everywhere — see utils/enterNavigation.ts.
  useEffect(() => {
    window.addEventListener('keydown', enterToNextField)
    return () => window.removeEventListener('keydown', enterToNextField)
  }, [])

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
        if (p.data) saveProductsToCache(p.data, { replace: true })
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
    const sync = async () => {
      const pending = getPendingSales()
      if (pending.length === 0) return
      let synced = 0
      for (const sale of pending) {
        try {
          const { data, error } = await supabase
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
              cash_amount: sale.tenders?.cash || 0,
              card_amount: sale.tenders?.card || 0,
              upi_amount: sale.tenders?.upi || 0,
              credit_amount: sale.creditRemainder || 0,
              credit_status: sale.creditRemainder > 0 ? 'unpaid' : 'paid',
              ...(sale.creditRemainder > 0 ? {
                credit_due_days: sale.creditDueDays,
                credit_due_date: sale.creditDueDate
              } : {}),
              is_return: false
            })
            .select()
            .single()
          if (!error && data) {
            if (sale.cart && sale.cart.length > 0) {
              // barcode is required on sale_items: without it every item was refused,
              // and the bill synced with no items.
              const { error: itemsErr } = await supabase.from('sale_items').insert(
                sale.cart.map((i: any) => ({
                  sale_id: data.id,
                  product_id: i.product.id,
                  barcode: i.product.barcode || i.product.sku || '',
                  qty: i.qty,
                  unit_price: i.unit_price,
                  discount_pct: i.discount_pct || 0,
                  gst_rate: i.product?.gst_rate || 5,
                  line_total: i.line_total
                }))
              )
              if (itemsErr) {
                // Take the bill back out and keep it queued: try again next time.
                await supabase.from('sales').delete().eq('id', data.id)
                console.warn('Sync: items refused, kept for retry:', itemsErr.message)
                continue
              }
              // The sale happened offline, so the shelf on the server never went down.
              await Promise.all(sale.cart.map((i: any) =>
                supabase.rpc('decrement_stock', { p_id: i.product.id, qty: i.qty })))
            }
            clearPendingSale(sale.pendingId)
            synced++
          }
        } catch (e) {
          console.warn('Sync notice:', e)
        }
      }
      if (synced > 0) toast.success(`${synced} offline bill${synced > 1 ? 's' : ''} synced to cloud!`)
    }

    (window as any).syncPendingSales = sync
    if (isOnline) sync()
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

  if (!authInitialized || showSplash) return <SplashScreen />
  
  if (!session) {
    return (
      <>
        <Toaster position="top-right" />
        <LoginScreen />
      </>
    )
  }

  if (storeStatus === 'locked' || storeStatus === 'past_due') {
    return <SubscriptionLockedScreen />
  }

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
        <Route path="/accounting" element={<AccountingPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/formats" element={<FormatDesignerPage />} />
        <Route path="/exchange" element={<ExchangePage />} />
        <Route path="/wholesale" element={<WholesalePage />} />
        <Route path="/wholesale-bills" element={<WholesaleBillsPage />} />
        <Route path="/purchase-entry" element={<PurchaseEntryPage />} />
        <Route path="/purchase-returns" element={<PurchaseReturnPage />} />
        <Route path="/purchase-bills" element={<PurchaseBillsPage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/online-listings" element={<OnlineListingsPage />} />
        <Route path="/online-orders" element={<OnlineOrdersPage />} />
        <Route path="/website-settings" element={<WebsiteSettingsPage />} />
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
