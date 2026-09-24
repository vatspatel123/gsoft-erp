import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { OnlineOrder, OnlineOrderStatus, OnlineOrderItem } from '../types/ecommerce'
import toast from 'react-hot-toast'
import { sendWhatsApp } from '../utils/whatsapp'

const STORAGE_ORDERS_KEY = 'gsoft_online_orders_cache'

export function useOnlineOrders() {
  const [orders, setOrders] = useState<OnlineOrder[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_ORDERS_KEY)
      if (cached) return JSON.parse(cached)
    } catch {}
    return []
  })
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | OnlineOrderStatus>('all')
  const [search, setSearch] = useState('')

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('online_orders')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100)

        if (!error && data) {
          setOrders(data)
          localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(data))
          return
        }
      }
    } catch (e) {
      console.warn('Notice loading online orders from cloud:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  // Listen for realtime orders if online
  useEffect(() => {
    fetchOrders()

    if (!navigator.onLine) return
    try {
      const channel = supabase
        .channel('online_orders_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'online_orders' }, payload => {
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as OnlineOrder
            setOrders(prev => [newOrder, ...prev])
            toast.success(`🎉 New Web Order #${newOrder.order_no} from ${newOrder.customer_name}!`, {
              duration: 6000,
              icon: '🛍️'
            })
            // Sound chime
            try {
              const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
              audio.play().catch(() => {})
            } catch {}
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as OnlineOrder
            setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
          } else if (payload.eventType === 'DELETE') {
            setOrders(prev => prev.filter(o => o.id !== (payload.old as any).id))
          }
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    } catch (e) {
      console.warn('Realtime channel notice:', e)
    }
  }, [fetchOrders])

  const updateOrderStatus = async (orderId: string, newStatus: OnlineOrderStatus) => {
    const updated = orders.map(o => o.id === orderId ? { ...o, order_status: newStatus } : o)
    setOrders(updated)
    localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(updated))

    if (navigator.onLine) {
      try {
        await supabase
          .from('online_orders')
          .update({ order_status: newStatus })
          .eq('id', orderId)
      } catch (e) {
        console.warn('DB order status update notice:', e)
      }
    }
    toast.success(`Order status updated to "${newStatus.toUpperCase()}"!`)
  }

  const updateTracking = async (orderId: string, courier: string, trackingNumber: string) => {
    const updated = orders.map(o => o.id === orderId ? {
      ...o,
      tracking_courier: courier,
      tracking_number: trackingNumber,
      order_status: 'shipped' as OnlineOrderStatus
    } : o)
    setOrders(updated)
    localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(updated))

    if (navigator.onLine) {
      try {
        await supabase
          .from('online_orders')
          .update({
            tracking_courier: courier,
            tracking_number: trackingNumber,
            order_status: 'shipped'
          })
          .eq('id', orderId)
      } catch (e) {
        console.warn('DB tracking update notice:', e)
      }
    }
    toast.success('Dispatched with tracking details! 🚚')
  }

  // Helper to place mock test order (useful for demo & testing from ERP)
  const createMockOrder = async (customerName: string, phone: string, items: OnlineOrderItem[]) => {
    const totalAmount = items.reduce((s, i) => s + (i.unit_price * i.qty), 0)
    const orderNo = 'WEB-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000)
    const newOrder: OnlineOrder = {
      id: crypto.randomUUID(),
      order_no: orderNo,
      customer_name: customerName || 'Website Customer',
      customer_phone: phone || '9876543210',
      customer_email: 'customer@example.com',
      shipping_address: '102, Shivalik Plaza, Ambawadi',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '380015',
      total_amount: totalAmount,
      discount_amount: 0,
      delivery_fee: totalAmount >= 999 ? 0 : 70,
      net_amount: totalAmount + (totalAmount >= 999 ? 0 : 70),
      payment_method: 'cod',
      payment_status: 'unpaid',
      order_status: 'new',
      items: items.map(i => ({
        ...i,
        line_total: i.unit_price * i.qty
      })),
      notes: 'Customer placed order via website',
      created_at: new Date().toISOString()
    }

    if (navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('online_orders')
          .insert(newOrder)
          .select()
          .single()
        if (!error && data) {
          setOrders(prev => [data, ...prev])
          toast.success(`Mock Web Order #${orderNo} created!`)
          return data
        }
      } catch (e) {
        console.warn('DB mock order insert notice:', e)
      }
    }

    setOrders(prev => [newOrder, ...prev])
    localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify([newOrder, ...orders]))
    toast.success(`Mock Web Order #${orderNo} created!`)
    return newOrder
  }

  // 1-Click WhatsApp Notification to Customer
  const sendWhatsAppUpdate = (order: OnlineOrder, type: 'confirm' | 'dispatch' | 'delivery') => {
    const cleanPhone = order.customer_phone.replace(/\D/g, '')
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone
    
    let msg = ''
    if (type === 'confirm') {
      msg =
        `*🛍️ ORDER CONFIRMED — #${order.order_no}*%0A%0A` +
        `Dear *${order.customer_name}*,%0A` +
        `Thank you for shopping with us online! We have received your order.%0A%0A` +
        `📦 *Items:* ${order.items.map(i => `${i.name} (x${i.qty})`).join(', ')}%0A` +
        `💰 *Total Amount:* ₹${order.net_amount.toFixed(2)} (${order.payment_method.toUpperCase()})%0A` +
        `📍 *Delivery Address:* ${order.shipping_address || ''}, ${order.city || ''}%0A%0A` +
        `We are packing your items and will notify you when dispatched! 🚚`
    } else if (type === 'dispatch') {
      msg =
        `*🚚 ORDER DISPATCHED — #${order.order_no}*%0A%0A` +
        `Dear *${order.customer_name}*,%0A` +
        `Great news! Your package is on its way.%0A%0A` +
        (order.tracking_courier ? `📦 *Courier:* ${order.tracking_courier}%0A` : '') +
        (order.tracking_number ? `📋 *Tracking Number / AWB:* ${order.tracking_number}%0A` : '') +
        `💰 *Amount Due on Delivery:* ₹${order.payment_status === 'paid' ? '0 (Paid)' : order.net_amount.toFixed(2)}%0A%0A` +
        `Thank you for shopping with us!`
    } else if (type === 'delivery') {
      msg =
        `*🎉 ORDER DELIVERED — #${order.order_no}*%0A%0A` +
        `Dear *${order.customer_name}*,%0A` +
        `Your package has been successfully delivered.%0A` +
        `We hope you love your purchase! Feel free to share your feedback or reach out if you need any assistance.%0A%0A` +
        `_Visit our website again soon!_`
    }

    sendWhatsApp(fullPhone, msg, { encoded: true })
  }

  // Convert Web Order to POS Invoice
  const convertToPOSBill = async (order: OnlineOrder) => {
    try {
      const invoiceNo = 'INV-WEB-' + Date.now().toString().slice(-6)
      const saleRecord = {
        invoice_no: invoiceNo,
        total_amount: order.total_amount,
        discount_amount: order.discount_amount,
        net_amount: order.net_amount,
        gst_amount: 0,
        payment_mode: order.payment_method === 'cod' ? 'cash' : 'upi',
        // Record the tender breakdown so web orders show up in the Cash Book too.
        cash_amount: order.payment_method === 'cod' ? order.net_amount : 0,
        upi_amount: order.payment_method === 'cod' ? 0 : order.net_amount,
        card_amount: 0,
        credit_amount: 0,
        credit_status: 'paid',
        is_return: false
      }

      if (navigator.onLine) {
        const { data: sale } = await supabase
          .from('sales')
          .insert(saleRecord)
          .select()
          .single()

        if (sale && order.items && order.items.length > 0) {
          await supabase.from('sale_items').insert(
            order.items.map(i => ({
              sale_id: sale.id,
              product_id: i.product_id || null,
              barcode: i.sku || i.design_no || 'WEB',
              qty: i.qty,
              unit_price: i.unit_price,
              discount_pct: 0,
              gst_rate: 5,
              line_total: i.line_total
            }))
          )
        }
      }

      await updateOrderStatus(order.id, 'confirmed')
      toast.success(`Converted to POS Bill #${invoiceNo}! ✅`)
      return invoiceNo
    } catch (e: any) {
      toast.error('Could not convert to bill: ' + e.message)
    }
  }

  const filteredOrders = orders.filter(o => {
    const q = search.toLowerCase()
    const matchesSearch = !q ||
      o.order_no.toLowerCase().includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      o.customer_phone.includes(q) ||
      (o.city && o.city.toLowerCase().includes(q))

    const matchesStatus = statusFilter === 'all' || o.order_status === statusFilter
    return matchesSearch && matchesStatus
  })

  const counts = {
    all: orders.length,
    new: orders.filter(o => o.order_status === 'new').length,
    confirmed: orders.filter(o => o.order_status === 'confirmed').length,
    packed: orders.filter(o => o.order_status === 'packed').length,
    shipped: orders.filter(o => o.order_status === 'shipped').length,
    delivered: orders.filter(o => o.order_status === 'delivered').length,
    cancelled: orders.filter(o => o.order_status === 'cancelled').length,
  }

  return {
    orders: filteredOrders,
    allOrders: orders,
    loading,
    search, setSearch,
    statusFilter, setStatusFilter,
    counts,
    fetchOrders,
    updateOrderStatus,
    updateTracking,
    createMockOrder,
    sendWhatsAppUpdate,
    convertToPOSBill
  }
}
