export interface Product {
  id: string
  name: string
  sku: string
  barcode: string | null
  serial_barcode: string | null
  category_id: string | null
  unit_price: number
  cost_price: number | null
  gst_rate: number
  photo_url: string | null
  stock_qty: number
  low_stock_alert: number
  is_active: boolean
  created_at: string
}

export interface Customer {
  id: string
  name: string
  phone: string
  email: string | null
  loyalty_points: number
  total_spent: number
  referral_code: string
}

export interface CartItem {
  product: Product
  qty: number
  unit_price: number
  discount_pct: number
  line_total: number
}

export interface Coupon {
  id: string
  code: string
  type: 'flat' | 'percentage' | 'gift'
  value: number
  min_order_value: number
  max_discount_cap: number | null
  max_uses: number | null
  used_count: number
  valid_from: string
  valid_to: string
  is_active: boolean
}

export interface Counter {
  id: string
  name: string
  location: string | null
  is_active: boolean
}

export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'cashier' | 'salesman' | 'accountant'
  counter_id: string | null
}

export interface Sale {
  id: string
  invoice_no: string
  customer_id: string | null
  salesman_id: string | null
  counter_id: string
  total_amount: number
  discount_amount: number
  coupon_code: string | null
  net_amount: number
  gst_amount: number
  payment_mode: 'cash' | 'card' | 'upi' | 'credit'
  loyalty_points_used: number
  is_return: boolean
  return_ref_id: string | null
  created_at: string
}

export type PaymentMode = 'cash' | 'card' | 'upi' | 'credit'
