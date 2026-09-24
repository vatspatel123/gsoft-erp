import { supabase } from '../lib/supabase'
import type { OnlineOrderItem } from '../types/ecommerce'

// Mirrors gsoft-erp/src/utils/websiteBridge.ts — kept in sync manually since
// this is a separate deployable app sharing the same Supabase project.

export async function getStorefrontProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .eq('is_online', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getStorefrontSettings() {
  const { data, error } = await supabase
    .from('website_settings')
    .select('*')
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

export interface PlaceOrderPayload {
  customerName: string
  customerPhone: string
  customerEmail?: string
  shippingAddress: string
  city: string
  state?: string
  pincode: string
  paymentMethod: 'cod' | 'online' | 'upi' | 'whatsapp'
  items: OnlineOrderItem[]
  notes?: string
}

export async function placeStorefrontOrder(payload: PlaceOrderPayload) {
  const totalAmount = payload.items.reduce((sum, item) => sum + (item.unit_price * item.qty), 0)
  const deliveryFee = totalAmount >= 999 ? 0 : 70
  const netAmount = totalAmount + deliveryFee
  const orderNo = 'WEB-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000)

  const orderData = {
    order_no: orderNo,
    customer_name: payload.customerName,
    customer_phone: payload.customerPhone,
    customer_email: payload.customerEmail || null,
    shipping_address: payload.shippingAddress,
    city: payload.city,
    state: payload.state || 'Gujarat',
    pincode: payload.pincode,
    total_amount: totalAmount,
    discount_amount: 0,
    delivery_fee: deliveryFee,
    net_amount: netAmount,
    payment_method: payload.paymentMethod,
    payment_status: payload.paymentMethod === 'online' ? 'paid' : 'unpaid',
    order_status: 'new',
    items: payload.items,
    notes: payload.notes || null,
    created_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('online_orders')
    .insert(orderData)
    .select()
    .single()

  if (error) throw error

  for (const item of payload.items) {
    if (item.product_id) {
      try {
        const { data: prod } = await supabase
          .from('products')
          .select('stock_qty')
          .eq('id', item.product_id)
          .single()

        if (prod) {
          const newQty = Math.max(0, (prod.stock_qty || 0) - item.qty)
          await supabase
            .from('products')
            .update({ stock_qty: newQty })
            .eq('id', item.product_id)
        }
      } catch (stockErr) {
        console.warn('Stock decrement notice:', stockErr)
      }
    }
  }

  return data
}

export function generateWhatsAppOrderLink(
  whatsappNumber: string,
  customer: { name: string; phone: string; address: string; city: string },
  items: OnlineOrderItem[],
  netAmount: number
) {
  const cleanNumber = whatsappNumber.replace(/\D/g, '')
  const phoneFormatted = cleanNumber.startsWith('91') ? cleanNumber : `91${cleanNumber}`

  const itemsList = items.map(i =>
    `  • ${encodeURIComponent(i.name)} (${i.size ? i.size + ', ' : ''}${i.colour || ''}) x${i.qty} = ₹${(i.unit_price * i.qty).toFixed(0)}`
  ).join('%0A')

  const msg =
    `*🛍️ NEW WEBSITE ORDER INQUIRY*%0A%0A` +
    `Hello! I would like to order the following items from your website:%0A%0A` +
    `*Order Items:*%0A${itemsList}%0A%0A` +
    `💰 *Total Amount:* ₹${netAmount.toFixed(0)}%0A%0A` +
    `*Customer Details:*%0A` +
    `👤 Name: ${encodeURIComponent(customer.name)}%0A` +
    `📱 Phone: ${encodeURIComponent(customer.phone)}%0A` +
    `📍 Address: ${encodeURIComponent(customer.address)}, ${encodeURIComponent(customer.city)}%0A%0A` +
    `Please confirm my order. Thank you!`

  return `https://wa.me/${phoneFormatted}?text=${msg}`
}
