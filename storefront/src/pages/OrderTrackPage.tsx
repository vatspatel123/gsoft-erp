import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { OnlineOrder } from '../types/ecommerce'

const INR = (n: number) => '₹' + n.toLocaleString('en-IN')

const STATUS_STEPS: OnlineOrder['order_status'][] = ['new', 'confirmed', 'packed', 'shipped', 'delivered']

export function OrderTrackPage() {
  const [orderNo, setOrderNo] = useState('')
  const [phone, setPhone] = useState('')
  const [order, setOrder] = useState<OnlineOrder | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLookup = async () => {
    setLoading(true)
    setError(null)
    setOrder(null)
    const { data, error: err } = await supabase
      .from('online_orders')
      .select('*')
      .eq('order_no', orderNo.trim())
      .eq('customer_phone', phone.trim())
      .maybeSingle()

    setLoading(false)
    if (err || !data) {
      setError('Order not found. Check your order number and phone number.')
      return
    }
    setOrder(data)
  }

  return (
    <main className="container" style={{ padding: '34px 24px 70px', maxWidth: 820 }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 'clamp(26px,3.4vw,36px)', margin: '0 0 20px' }}>Track your order</h1>

      {!order && (
        <div style={{ background: '#fff', border: '1px solid rgba(51,59,71,.09)', borderRadius: 18, padding: 24, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
          <input value={orderNo} onChange={e => setOrderNo(e.target.value)} placeholder="Order number (e.g. WEB-20260914-1234)" style={{ border: '1px solid rgba(51,59,71,.18)', borderRadius: 10, padding: '13px 14px', fontSize: 14.5 }} />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number used at checkout" style={{ border: '1px solid rgba(51,59,71,.18)', borderRadius: 10, padding: '13px 14px', fontSize: 14.5 }} />
          {error && <div style={{ color: '#c0392b', fontSize: 13 }}>{error}</div>}
          <button type="button" onClick={handleLookup} disabled={loading || !orderNo || !phone} className="btn-pill btn-primary" style={{ justifyContent: 'center' }}>
            {loading ? 'Searching...' : 'Track order'}
          </button>
        </div>
      )}

      {order && (
        <div>
          <p style={{ margin: '0 0 26px', fontSize: 14, fontWeight: 300, color: 'rgba(51,59,71,.62)' }}>
            {INR(order.net_amount)} · {order.payment_method.toUpperCase()} · Order {order.order_no}
          </p>
          <div style={{ background: '#fff', border: '1px solid rgba(51,59,71,.09)', borderRadius: 18, padding: 24 }}>
            {STATUS_STEPS.map(step => {
              const currentIdx = STATUS_STEPS.indexOf(order.order_status)
              const stepIdx = STATUS_STEPS.indexOf(step)
              const done = order.order_status === 'cancelled' ? false : stepIdx <= currentIdx
              return (
                <div key={step} style={{ display: 'flex', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
                    <span style={{ width: 15, height: 15, borderRadius: 999, background: done ? 'var(--pink)' : '#fff', border: `2px solid ${done ? 'var(--pink)' : 'rgba(51,59,71,.25)'}` }} />
                    <span style={{ width: 2, flex: '1 1 auto', minHeight: 34, background: done ? 'var(--pink)' : 'rgba(51,59,71,.15)' }} />
                  </div>
                  <div style={{ paddingBottom: 18 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: done ? 'var(--navy)' : 'rgba(51,59,71,.4)', textTransform: 'capitalize' }}>{step}</div>
                  </div>
                </div>
              )
            })}
            {order.order_status === 'cancelled' && <div style={{ color: '#c0392b', fontSize: 14 }}>This order was cancelled.</div>}
            {order.tracking_number && (
              <div style={{ fontSize: 13, color: 'rgba(51,59,71,.6)', marginTop: 8 }}>Tracking: {order.tracking_number} {order.tracking_courier ? `via ${order.tracking_courier}` : ''}</div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
