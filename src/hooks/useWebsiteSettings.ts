import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { WebsiteSettings } from '../types/ecommerce'
import toast from 'react-hot-toast'

const DEFAULT_SETTINGS: WebsiteSettings = {
  store_name: 'GSoft Retail Store',
  tagline: 'Fashion & Retail Boutique',
  logo_url: '',
  hero_title: 'Exclusive Fashion Collection 2026',
  hero_subtitle: 'Discover trending ethnic & western wear with premium quality and instant home delivery.',
  hero_banner_url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200&auto=format&fit=crop',
  hero_banners: [
    'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1445205170230-053b83016050?q=80&w=1200&auto=format&fit=crop'
  ],
  announcement_bar: '🎉 Festive Sale! Free Home Delivery on all orders above ₹999!',
  show_announcement: true,
  whatsapp_number: '919876543210',
  enable_whatsapp_checkout: true,
  enable_cod: true,
  min_order_free_shipping: 999,
  standard_delivery_fee: 70,
  theme_color: '#9333ea',
  instagram_url: 'https://instagram.com',
  facebook_url: 'https://facebook.com',
  contact_address: 'Ahmedabad, Gujarat, India'
}

const STORAGE_KEY = 'gsoft_website_settings_cache'

export function useWebsiteSettings() {
  const [settings, setSettings] = useState<WebsiteSettings>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached) return { ...DEFAULT_SETTINGS, ...JSON.parse(cached) }
    } catch {}
    return DEFAULT_SETTINGS
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('website_settings')
          .select('*')
          .limit(1)
          .maybeSingle()

        if (!error && data) {
          const merged = { ...DEFAULT_SETTINGS, ...data }
          setSettings(merged)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
          return
        }
      }
    } catch (e) {
      console.warn('Notice loading website settings from cloud:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const saveSettings = async (newSettings: Partial<WebsiteSettings>) => {
    setSaving(true)
    const updated: WebsiteSettings = { ...settings, ...newSettings }
    setSettings(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))

    try {
      if (navigator.onLine) {
        // Upsert to Supabase
        const { data: existing } = await supabase
          .from('website_settings')
          .select('id')
          .limit(1)
          .maybeSingle()

        if (existing?.id) {
          await supabase
            .from('website_settings')
            .update(updated)
            .eq('id', existing.id)
        } else {
          await supabase
            .from('website_settings')
            .insert(updated)
        }
      }
      toast.success('Website settings updated! 🚀')
      return true
    } catch (e: any) {
      console.warn('Saved website settings locally:', e)
      toast.success('Website settings updated!')
      return true
    } finally {
      setSaving(false)
    }
  }

  const addHeroBanner = async (bannerUrl: string) => {
    if (!bannerUrl.trim()) return
    const banners = [...(settings.hero_banners || []), bannerUrl.trim()]
    await saveSettings({ hero_banners: banners, hero_banner_url: banners[0] })
  }

  const removeHeroBanner = async (index: number) => {
    const banners = (settings.hero_banners || []).filter((_, i) => i !== index)
    await saveSettings({
      hero_banners: banners,
      hero_banner_url: banners.length > 0 ? banners[0] : null
    })
  }

  return {
    settings,
    loading,
    saving,
    fetchSettings,
    saveSettings,
    addHeroBanner,
    removeHeroBanner
  }
}
