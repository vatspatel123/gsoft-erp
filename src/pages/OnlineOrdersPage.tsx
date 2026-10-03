import React, { useState } from 'react'
import { Layout } from '../components/shared/Layout'
import {
  ShoppingBag,
  Search,
  RefreshCw,
  Send,
  Truck,
  CheckCircle2,
  Clock,
  Package,
  AlertCircle,
  FileText,
  Phone,
  MapPin,
  Eye,
  PlusCircle,
  X,
  CreditCard,
  User,
  Layers
} from 'lucide-react'
import { useOnlineOrders } from '../hooks/useOnlineOrders'
import { useOnlineStore } from '../hooks/useOnlineStore'
import type { OnlineOrder, OnlineOrderStatus } from '../types/ecommerce'
import { fmtDateTime } from '../utils/date'

const P = {
  primary: '#9333ea',
  light: '#f5f3ff',
  border: '#e9d5ff',
  borderLight: '#f3e8ff',
  text: '#1a0a2e',
  muted: '#64748b',
  bg: '#fdf8ff',
  card: '#ffffff',
  shadow: '0 4px 16px rgba(147, 51, 234, 0.08)',
  shadowSm: '0 2px 6px rgba(147, 51, 234, 0.05)',
  radius: '14px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: `1px solid ${P.borderLight}`,
  borderRadius: '10px',
  padding: '9px 14px',
  fontSize: '13px',
  fontFamily: "'DM Sans', sans-serif",
  outline: 'none',
  color: P.text,
  background: '#ffffff',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: P.primary,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '6px',
  display: 'block',
}

export const OnlineOrdersPage: React.FC = () => {
  const {
    orders,
    allOrders,
    loading,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    counts,
    fetchOrders,
    updateOrderStatus,
    updateTracking,
    createMockOrder,
    sendWhatsAppUpdate,
    convertToPOSBill
  } = useOnlineOrders()

  const { products } = useOnlineStore()

  const [selectedOrder, setSelectedOrder] = useState<OnlineOrder | null>(null)
  const [dispatchModalOrder, setDispatchModalOrder] = useState<OnlineOrder | null>(null)
  const [courierName, setCourierName] = useState('Delhivery')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [showMockOrderModal, setShowMockOrderModal] = useState(false)
  const [mockCustName, setMockCustName] = useState('Pooja Shah')
  const [mockCustPhone, setMockCustPhone] = useState('9898123456')

  const totalRevenue = allOrders
    .filter(o => o.order_status !== 'cancelled')
    .reduce((s, o) => s + (o.net_amount || 0), 0)

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dispatchModalOrder) return
    await updateTracking(dispatchModalOrder.id, courierName, trackingNumber)
    sendWhatsAppUpdate({ ...dispatchModalOrder, tracking_courier: courierName, tracking_number: trackingNumber }, 'dispatch')
    setDispatchModalOrder(null)
    setTrackingNumber('')
  }

  const handleCreateMock = async () => {
    const sampleItems = products.slice(0, 2).map(p => ({
      id: crypto.randomUUID(),
      product_id: p.id,
      name: p.name,
      sku: p.sku || p.design_no || 'SKU-SAMPLE',
      design_no: p.design_no,
      size: p.size || 'M',
      color: p.color || 'Standard',
      qty: 1,
      unit_price: p.online_price || p.selling_price || 999,
      line_total: p.online_price || p.selling_price || 999,
      image_url: p.photo_url || p.photos?.[0]
    }))

    if (sampleItems.length === 0) {
      sampleItems.push({
        id: crypto.randomUUID(),
        product_id: undefined,
        name: 'Designer Georgette Anarkali Suit',
        sku: 'SKU-ANK-01',
        design_no: 'ANK-102',
        size: 'L',
        color: 'Royal Blue',
        qty: 1,
        unit_price: 1899,
        line_total: 1899,
        image_url: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=400&auto=format&fit=crop'
      })
    }

    await createMockOrder(mockCustName, mockCustPhone, sampleItems)
    setShowMockOrderModal(false)
  }

  const getStatusBadge = (status: OnlineOrderStatus) => {
    const baseStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '4px 10px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: 700,
    }

    switch (status) {
      case 'new':
        return (
          <span style={{ ...baseStyle, background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
            <Clock size={12} /> New Order
          </span>
        )
      case 'confirmed':
        return (
          <span style={{ ...baseStyle, background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
            <CheckCircle2 size={12} /> Confirmed
          </span>
        )
      case 'packed':
        return (
          <span style={{ ...baseStyle, background: P.light, color: P.primary, border: `1px solid ${P.border}` }}>
            <Package size={12} /> Packed
          </span>
        )
      case 'shipped':
        return (
          <span style={{ ...baseStyle, background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>
            <Truck size={12} /> Shipped
          </span>
        )
      case 'delivered':
        return (
          <span style={{ ...baseStyle, background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>
            <CheckCircle2 size={12} /> Delivered
          </span>
        )
      case 'cancelled':
        return (
          <span style={{ ...baseStyle, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}>
            <AlertCircle size={12} /> Cancelled
          </span>
        )
      default:
        return null
    }
  }

  return (
    <Layout>
      <div style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto', fontFamily: "'DM Sans', sans-serif" }}>
        {/* Header Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
          background: 'white',
          padding: '20px 24px',
          borderRadius: P.radius,
          border: `1px solid ${P.borderLight}`,
          boxShadow: P.shadowSm
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 4px 12px rgba(147, 51, 234, 0.3)'
            }}>
              <ShoppingBag size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: P.text, margin: 0 }}>
                Online Store Orders
              </h1>
              <p style={{ fontSize: '13px', color: P.muted, margin: '2px 0 0 0' }}>
                Manage website orders, WhatsApp customer tracking, and 1-click POS billing conversion
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setShowMockOrderModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 18px',
                background: P.light,
                color: P.primary,
                border: `1px solid ${P.border}`,
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <PlusCircle size={16} />
              Create Test Order
            </button>
            <button
              onClick={() => fetchOrders()}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 18px',
                background: 'white',
                color: P.text,
                border: `1px solid ${P.borderLight}`,
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Metric Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'white', padding: '18px 20px', borderRadius: P.radius, border: `1px solid ${P.borderLight}`, boxShadow: P.shadowSm }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: P.muted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
              <span>New Web Orders</span>
              <Clock size={16} color="#f59e0b" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: P.text, marginTop: '8px' }}>
              {counts.new}
            </div>
            <div style={{ fontSize: '11px', color: '#d97706', fontWeight: 600, marginTop: '2px' }}>
              Action required
            </div>
          </div>

          <div style={{ background: 'white', padding: '18px 20px', borderRadius: P.radius, border: `1px solid ${P.borderLight}`, boxShadow: P.shadowSm }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: P.muted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
              <span>Confirmed / Packing</span>
              <Package size={16} color={P.primary} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: P.text, marginTop: '8px' }}>
              {counts.confirmed + counts.packed}
            </div>
            <div style={{ fontSize: '11px', color: P.primary, fontWeight: 600, marginTop: '2px' }}>
              Ready for dispatch
            </div>
          </div>

          <div style={{ background: 'white', padding: '18px 20px', borderRadius: P.radius, border: `1px solid ${P.borderLight}`, boxShadow: P.shadowSm }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: P.muted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
              <span>Dispatched / In Transit</span>
              <Truck size={16} color="#6366f1" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: P.text, marginTop: '8px' }}>
              {counts.shipped}
            </div>
            <div style={{ fontSize: '11px', color: '#4f46e5', fontWeight: 600, marginTop: '2px' }}>
              With courier partner
            </div>
          </div>

          <div style={{ background: 'white', padding: '18px 20px', borderRadius: P.radius, border: `1px solid ${P.borderLight}`, boxShadow: P.shadowSm }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: P.muted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
              <span>Website Gross Sales</span>
              <CreditCard size={16} color="#10b981" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#15803d', marginTop: '8px' }}>
              ₹{totalRevenue.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '11px', color: P.muted, marginTop: '2px' }}>
              {counts.all} total online orders
            </div>
          </div>
        </div>

        {/* Orders Table Container */}
        <div style={{
          background: 'white',
          borderRadius: P.radius,
          border: `1px solid ${P.borderLight}`,
          boxShadow: P.shadowSm,
          overflow: 'hidden'
        }}>
          {/* Filters & Search Row */}
          <div style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${P.borderLight}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            background: '#faf5ff'
          }}>
            {/* Status Tabs */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(
                [
                  { key: 'all', label: 'All', count: counts.all },
                  { key: 'new', label: 'New', count: counts.new },
                  { key: 'confirmed', label: 'Confirmed', count: counts.confirmed },
                  { key: 'packed', label: 'Packed', count: counts.packed },
                  { key: 'shipped', label: 'Shipped', count: counts.shipped },
                  { key: 'delivered', label: 'Delivered', count: counts.delivered },
                  { key: 'cancelled', label: 'Cancelled', count: counts.cancelled }
                ] as const
              ).map(tab => {
                const isActive = statusFilter === tab.key
                return (
                  <button
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: isActive ? 700 : 500,
                      background: isActive ? P.primary : 'white',
                      color: isActive ? 'white' : P.text,
                      border: isActive ? 'none' : `1px solid ${P.borderLight}`,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: isActive ? '0 2px 6px rgba(147,51,234,0.25)' : 'none'
                    }}
                  >
                    <span>{tab.label}</span>
                    <span style={{
                      background: isActive ? 'rgba(255,255,255,0.25)' : P.light,
                      color: isActive ? 'white' : P.primary,
                      padding: '1px 6px',
                      borderRadius: '10px',
                      fontSize: '10px',
                      fontWeight: 700
                    }}>
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Search Box */}
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={16} color={P.muted} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                style={{ ...inputStyle, paddingLeft: '32px' }}
                placeholder="Search order #, customer, phone..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          {orders.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <ShoppingBag size={48} color="#d8b4fe" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: P.text, margin: 0 }}>
                No online orders found
              </h3>
              <p style={{ fontSize: '13px', color: P.muted, margin: '4px 0 16px' }}>
                {search || statusFilter !== 'all'
                  ? 'Try changing your search keywords or status filter.'
                  : 'Orders placed on your Claude e-commerce store will appear here instantly with live sound chime.'}
              </p>
              <button
                onClick={() => setShowMockOrderModal(true)}
                style={{
                  padding: '9px 18px',
                  background: P.light,
                  color: P.primary,
                  border: `1px solid ${P.border}`,
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                + Place Demo Order to Test
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#faf5ff', borderBottom: `1px solid ${P.borderLight}`, textAlign: 'left', color: P.muted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '12px 18px' }}>Order Info</th>
                    <th style={{ padding: '12px 18px' }}>Customer</th>
                    <th style={{ padding: '12px 18px' }}>Items</th>
                    <th style={{ padding: '12px 18px' }}>Amount & Pay</th>
                    <th style={{ padding: '12px 18px' }}>Status</th>
                    <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id} style={{ borderBottom: `1px solid ${P.borderLight}`, transition: 'background 0.15s' }}>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 800, color: P.primary, fontFamily: 'monospace', fontSize: '14px' }}>
                          #{order.order_no}
                        </div>
                        <div style={{ fontSize: '11px', color: P.muted, marginTop: '2px' }}>
                          {fmtDateTime(new Date(order.created_at))}
                        </div>
                        {order.tracking_number && (
                          <div style={{ marginTop: '4px', fontSize: '10px', background: '#e0e7ff', color: '#4338ca', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', fontWeight: 600 }}>
                            🚚 {order.tracking_courier}: {order.tracking_number}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 700, color: P.text }}>{order.customer_name}</div>
                        <div style={{ fontSize: '12px', color: P.muted, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <Phone size={12} color={P.muted} /> {order.customer_phone}
                        </div>
                        {order.city && (
                          <div style={{ fontSize: '11px', color: P.muted, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <MapPin size={11} color={P.muted} /> {order.city}, {order.pincode}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 600, color: P.text }}>
                          {order.items?.length || 0} items
                        </div>
                        <div style={{ fontSize: '11px', color: P.muted, maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {order.items?.map(i => `${i.name} (x${i.qty})`).join(', ')}
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 800, color: P.text, fontSize: '14px' }}>
                          ₹{order.net_amount.toFixed(2)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: order.payment_method === 'cod' ? '#fef3c7' : '#dcfce7',
                            color: order.payment_method === 'cod' ? '#92400e' : '#166534',
                            textTransform: 'uppercase'
                          }}>
                            {order.payment_method}
                          </span>
                          <span style={{ fontSize: '11px', color: order.payment_status === 'paid' ? '#16a34a' : P.muted, fontWeight: 600 }}>
                            {order.payment_status}
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div>{getStatusBadge(order.order_status)}</div>
                          <select
                            value={order.order_status}
                            onChange={e => updateOrderStatus(order.id, e.target.value as OnlineOrderStatus)}
                            style={{
                              fontSize: '11px',
                              padding: '3px 6px',
                              borderRadius: '6px',
                              border: `1px solid ${P.borderLight}`,
                              background: 'white',
                              color: P.text,
                              cursor: 'pointer'
                            }}
                          >
                            <option value="new">New</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="packed">Packed</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => sendWhatsAppUpdate(order, 'confirm')}
                            title="Send WhatsApp Order Confirmation"
                            style={{
                              padding: '6px 10px',
                              background: '#f0fdf4',
                              color: '#16a34a',
                              border: '1px solid #bbf7d0',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Send size={13} /> WA
                          </button>

                          <button
                            onClick={() => convertToPOSBill(order)}
                            title="Convert to POS retail tax invoice"
                            style={{
                              padding: '6px 10px',
                              background: P.light,
                              color: P.primary,
                              border: `1px solid ${P.border}`,
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <FileText size={13} /> POS Bill
                          </button>

                          <button
                            onClick={() => {
                              setDispatchModalOrder(order)
                              setTrackingNumber(order.tracking_number || '')
                              setCourierName(order.tracking_courier || 'Delhivery')
                            }}
                            title="Add Courier Tracking & Mark Shipped"
                            style={{
                              padding: '6px',
                              background: '#e0e7ff',
                              color: '#4338ca',
                              border: '1px solid #c7d2fe',
                              borderRadius: '8px',
                              cursor: 'pointer'
                            }}
                          >
                            <Truck size={14} />
                          </button>

                          <button
                            onClick={() => setSelectedOrder(order)}
                            title="View Full Order Details"
                            style={{
                              padding: '6px',
                              background: '#f1f5f9',
                              color: P.text,
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              cursor: 'pointer'
                            }}
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Details Modal */}
        {selectedOrder && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '18px',
              maxWidth: '650px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              padding: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: `1px solid ${P.borderLight}`, paddingBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: P.text, margin: 0 }}>
                    Order #{selectedOrder.order_no}
                  </h3>
                  <div style={{ fontSize: '12px', color: P.muted, marginTop: '2px' }}>
                    Placed on {fmtDateTime(new Date(selectedOrder.created_at))}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: P.muted }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Customer summary */}
              <div style={{ background: P.bg, borderRadius: '12px', padding: '16px', marginBottom: '20px', border: `1px solid ${P.borderLight}` }}>
                <div style={{ fontWeight: 700, color: P.text }}>{selectedOrder.customer_name}</div>
                <div style={{ fontSize: '12px', color: P.muted, marginTop: '2px' }}>📞 {selectedOrder.customer_phone}</div>
                <div style={{ fontSize: '12px', color: P.muted, marginTop: '2px' }}>
                  📍 {selectedOrder.shipping_address}, {selectedOrder.city} {selectedOrder.pincode}
                </div>
              </div>

              {/* Items */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: P.text, marginBottom: '10px' }}>
                  Items in Order ({selectedOrder.items?.length || 0})
                </div>
                <div style={{ border: `1px solid ${P.borderLight}`, borderRadius: '10px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#faf5ff', textAlign: 'left', color: P.muted, borderBottom: `1px solid ${P.borderLight}` }}>
                        <th style={{ padding: '8px 12px' }}>Product</th>
                        <th style={{ padding: '8px 12px' }}>Qty</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Price</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items?.map((item, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${P.borderLight}` }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>{item.name}</td>
                          <td style={{ padding: '10px 12px' }}>{item.qty}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>₹{item.unit_price.toFixed(2)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>₹{item.line_total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Price total */}
              <div style={{ textAlign: 'right', marginBottom: '20px', fontSize: '13px', color: P.muted }}>
                <div>Subtotal: ₹{selectedOrder.total_amount.toFixed(2)}</div>
                <div>Delivery Fee: {selectedOrder.delivery_fee === 0 ? 'FREE' : `₹${selectedOrder.delivery_fee.toFixed(2)}`}</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: P.primary, marginTop: '4px' }}>
                  Grand Total: ₹{selectedOrder.net_amount.toFixed(2)}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={() => sendWhatsAppUpdate(selectedOrder, 'confirm')}
                  style={{
                    padding: '10px 16px',
                    background: '#f0fdf4',
                    color: '#16a34a',
                    border: '1px solid #bbf7d0',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Send WhatsApp Update
                </button>
                <button
                  onClick={() => {
                    convertToPOSBill(selectedOrder)
                    setSelectedOrder(null)
                  }}
                  style={{
                    padding: '10px 18px',
                    background: P.primary,
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Convert to POS Bill
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dispatch Modal */}
        {dispatchModalOrder && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px'
          }}>
            <form onSubmit={handleDispatchSubmit} style={{
              background: 'white',
              borderRadius: '18px',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              padding: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: P.text, margin: 0 }}>
                  🚚 Dispatch #{dispatchModalOrder.order_no}
                </h3>
                <button
                  type="button"
                  onClick={() => setDispatchModalOrder(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: P.muted }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Courier Partner</label>
                <select
                  style={inputStyle}
                  value={courierName}
                  onChange={e => setCourierName(e.target.value)}
                >
                  <option value="Delhivery">Delhivery</option>
                  <option value="BlueDart">BlueDart</option>
                  <option value="DTDC">DTDC</option>
                  <option value="Shiprocket">Shiprocket</option>
                  <option value="India Post">India Post</option>
                  <option value="Local Store Delivery">Local Hand Delivery</option>
                </select>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>AWB Tracking Number</label>
                <input
                  required
                  style={{ ...inputStyle, fontFamily: 'monospace' }}
                  placeholder="e.g. DLV987654321IN"
                  value={trackingNumber}
                  onChange={e => setTrackingNumber(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setDispatchModalOrder(null)}
                  style={{ padding: '9px 16px', background: '#f1f5f9', color: P.text, border: 'none', borderRadius: '10px', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '9px 18px', background: P.primary, color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Confirm & Notify Customer
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Test Order Modal */}
        {showMockOrderModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '18px',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              padding: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: P.text, margin: 0 }}>
                  🛍️ Create Simulated Test Order
                </h3>
                <button
                  type="button"
                  onClick={() => setShowMockOrderModal(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: P.muted }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Customer Name</label>
                <input
                  style={inputStyle}
                  value={mockCustName}
                  onChange={e => setMockCustName(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Customer WhatsApp Phone</label>
                <input
                  style={inputStyle}
                  value={mockCustPhone}
                  onChange={e => setMockCustPhone(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowMockOrderModal(false)}
                  style={{ padding: '9px 16px', background: '#f1f5f9', color: P.text, border: 'none', borderRadius: '10px', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateMock}
                  style={{ padding: '9px 18px', background: P.primary, color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Place Test Order
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
export default OnlineOrdersPage
