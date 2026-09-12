export type OnlineOrderStatus = 'new' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled'
export type PaymentMethod = 'cod' | 'online' | 'upi' | 'whatsapp'
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded'

export interface OnlineOrderItem {
  product_id?: string
  name: string
  sku?: string
  design_no?: string
  size?: string
  colour?: string
  qty: number
  unit_price: number
  mrp?: number
  line_total: number
  photo_url?: string
}

export interface OnlineOrder {
  id: string
  order_no: string
  customer_name: string
  customer_phone: string
  customer_email?: string | null
  shipping_address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  total_amount: number
  discount_amount: number
  delivery_fee: number
  net_amount: number
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  order_status: OnlineOrderStatus
  tracking_number?: string | null
  tracking_courier?: string | null
  items: OnlineOrderItem[]
  notes?: string | null
  created_at: string
}

export interface WebsiteSettings {
  id?: string
  store_name: string
  tagline: string
  logo_url?: string | null
  hero_title: string
  hero_subtitle: string
  hero_banner_url?: string | null
  hero_banners: string[]
  announcement_bar: string
  show_announcement: boolean
  whatsapp_number: string
  enable_whatsapp_checkout: boolean
  enable_cod: boolean
  min_order_free_shipping: number
  standard_delivery_fee: number
  theme_color: string
  instagram_url?: string | null
  facebook_url?: string | null
  contact_address?: string | null
}
