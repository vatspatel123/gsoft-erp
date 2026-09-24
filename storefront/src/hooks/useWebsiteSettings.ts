import { useState, useEffect } from 'react'
import { getStorefrontSettings } from '../api/storefront'
import type { WebsiteSettings } from '../types/ecommerce'

const DEFAULT_SETTINGS: WebsiteSettings = {
  store_name: 'Urmii All Plus',
  tagline: 'Premium fashion, sizes L to 7XL',
  hero_title: 'Unapologetic Style. Uncompromising Fit.',
  hero_subtitle: 'Premium fashion engineered for your curves. Because style has no size limit.',
  hero_banners: [],
  announcement_bar: 'Free Shipping on All Prepaid Orders | Partial COD Available | Sizes L to 7XL',
  show_announcement: true,
  whatsapp_number: '',
  enable_whatsapp_checkout: true,
  enable_cod: true,
  min_order_free_shipping: 999,
  standard_delivery_fee: 70,
  theme_color: '#C42A78'
}

export function useWebsiteSettings() {
  const [settings, setSettings] = useState<WebsiteSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getStorefrontSettings()
      .then(data => {
        if (!cancelled && data) setSettings({ ...DEFAULT_SETTINGS, ...data })
      })
      .catch(err => console.warn('Website settings notice:', err))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { settings, loading }
}
