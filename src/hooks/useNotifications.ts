import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { getCachedProducts } from '../utils/offlineCache'

export function useNotifications() {
  useEffect(() => {
    const run = async () => {
      // 1. Low stock alert from cache (fast, no network needed)
      const cached = getCachedProducts()
      if (cached) {
        const lowStock = cached.filter(
          p => p.is_active && p.stock_qty <= p.low_stock_alert && p.stock_qty > 0
        )
        if (lowStock.length > 0) {
          const names = lowStock.slice(0, 3).map(p => p.name).join(', ')
          const extra = lowStock.length > 3 ? ` +${lowStock.length - 3} more` : ''
          toast(`⚠️ ${lowStock.length} product${lowStock.length > 1 ? 's' : ''} running low: ${names}${extra}`, {
            duration: 6000,
            style: { background: '#fff7ed', color: '#92400e', border: '1px solid #fed7aa' }
          })
        }
      }

      if (!navigator.onLine) return

      try {
        // 2. Birthday customers today
        const today = new Date()
        const mmdd = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        const { data: bday } = await supabase
          .from('customers')
          .select('name, date_of_birth')
          .not('date_of_birth', 'is', null)

        if (bday) {
          const todayBirthdays = bday.filter(c => {
            if (!c.date_of_birth) return false
            return c.date_of_birth.slice(5) === mmdd
          })
          if (todayBirthdays.length > 0) {
            const names = todayBirthdays.slice(0, 2).map(c => c.name).join(', ')
            toast(`🎂 Birthday today: ${names}${todayBirthdays.length > 2 ? ` +${todayBirthdays.length - 2} more` : ''}! Check Customers page.`, {
              duration: 7000,
              style: { background: '#fdf2f8', color: '#86198f', border: '1px solid #f0abfc' }
            })
          }
        }

        // 3. Customer Credit Sales Overdue > 15 Days
        const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
        const { data: overdue15Days } = await supabase
          .from('sales')
          .select('net_amount')
          .eq('payment_mode', 'credit')
          .lte('created_at', fifteenDaysAgo)
          .eq('is_return', false)

        if (overdue15Days && overdue15Days.length > 0) {
          const totalOverdue = overdue15Days.reduce((sum, s) => sum + (s.net_amount || 0), 0)
          toast(`⚠️ ${overdue15Days.length} customer credit bill${overdue15Days.length > 1 ? 's' : ''} overdue (> 15 days) — Total ₹${totalOverdue.toLocaleString('en-IN')}. Check Invoices to send WhatsApp reminders.`, {
            duration: 8000,
            style: { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }
          })
        }

        // 4. Supplier Purchase Bills Due > 30 Days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        try {
          const { data: supplierDues } = await supabase
            .from('inward_challans')
            .select('total_amount, bill_amount')
            .lte('created_at', thirtyDaysAgo)
            .limit(10)

          if (supplierDues && supplierDues.length > 0) {
            toast(`🔔 Reminder: Supplier purchase bills older than 30 days pending review/payment.`, {
              duration: 7000,
              style: { background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }
            })
          }
        } catch {}
      } catch (e) {
        // Silently fail — notifications are non-critical
      }
    }

    // Run after a short delay so the app finishes loading first
    const timer = setTimeout(run, 3000)
    return () => clearTimeout(timer)
  }, [])
}
