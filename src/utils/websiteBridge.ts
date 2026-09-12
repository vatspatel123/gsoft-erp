import { supabase } from '../lib/supabase'
import type { OnlineOrderItem } from '../types/ecommerce'

/**
 * E-COMMERCE STOREFRONT BRIDGE FOR CLAUDE-BUILT WEBSITE
 * 
 * This module allows the client's website (built in Claude / Next.js / HTML / React)
 * to communicate directly with GSoft Retail ERP via Supabase with 100% unified real-time inventory.
 */

// 1. Fetch live products for website catalog
export async function getStorefrontProducts() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .eq('is_online', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error fetching storefront products:', err)
    return []
  }
}

// 2. Fetch website settings & homepage banners
export async function getStorefrontSettings() {
  try {
    const { data, error } = await supabase
      .from('website_settings')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data
  } catch (err) {
    console.error('Error fetching website settings:', err)
    return null
  }
}

// 3. Submit Customer Order from Website
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

  // Insert order in Supabase
  const { data, error } = await supabase
    .from('online_orders')
    .insert(orderData)
    .select()
    .single()

  if (error) throw error

  // Decrement inventory stock in products table
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

// 4. Generate WhatsApp Direct Checkout Link
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

// 5. Integration Code Snippet for Claude-built Storefront
export function generateStorefrontSnippet(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://cogrniduhhoeepdkesjx.supabase.co'
  const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'

  return `<!-- ==========================================
  GSoft Retail ERP — Storefront Integration Script
  Unified Real-time Inventory & Order Sync Bridge
========================================== -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
  // 1. Initialize ERP Bridge
  const gsoftClient = supabase.createClient(
    '${supabaseUrl}',
    '${supabaseAnon}'
  );

  window.GSoftStore = {
    // Fetch live products for catalog & stock check
    async getProducts() {
      const { data, error } = await gsoftClient
        .from('products')
        .select('*')
        .eq('is_active', true)
        .eq('is_online', true)
        .order('created_at', { ascending: false });
      if (error) { console.error(error); return []; }
      return data || [];
    },

    // Fetch store banners & settings
    async getSettings() {
      const { data } = await gsoftClient
        .from('website_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      return data;
    },

    // Submit online customer order into ERP
    async createOrder(orderPayload) {
      const totalAmount = orderPayload.items.reduce((s, i) => s + (i.unit_price * i.qty), 0);
      const deliveryFee = totalAmount >= 999 ? 0 : 70;
      const netAmount = totalAmount + deliveryFee;
      const orderNo = 'WEB-' + Date.now().toString().slice(-8);

      const { data, error } = await gsoftClient
        .from('online_orders')
        .insert({
          order_no: orderNo,
          customer_name: orderPayload.customerName,
          customer_phone: orderPayload.customerPhone,
          customer_email: orderPayload.customerEmail || null,
          shipping_address: orderPayload.shippingAddress,
          city: orderPayload.city,
          state: orderPayload.state || 'Gujarat',
          pincode: orderPayload.pincode,
          total_amount: totalAmount,
          discount_amount: 0,
          delivery_fee: deliveryFee,
          net_amount: netAmount,
          payment_method: orderPayload.paymentMethod || 'cod',
          payment_status: 'unpaid',
          order_status: 'new',
          items: orderPayload.items,
          notes: orderPayload.notes || null,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  };
</script>`
}

