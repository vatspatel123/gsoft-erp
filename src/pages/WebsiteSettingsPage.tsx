import React, { useState, useEffect } from 'react'
import { Layout } from '../components/shared/Layout'
import {
  Globe,
  Layout as LayoutIcon,
  Image as ImageIcon,
  MessageSquare,
  Truck,
  Code,
  Save,
  Plus,
  Trash2,
  Copy,
  Check,
  Palette,
  Sparkles,
  Phone,
  Store
} from 'lucide-react'
import { useWebsiteSettings } from '../hooks/useWebsiteSettings'
import { generateStorefrontSnippet } from '../utils/websiteBridge'
import toast from 'react-hot-toast'

// ERP Purple Theme Tokens
const P = {
  primary: '#9333ea',
  primaryHover: '#7e22ce',
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
  padding: '10px 14px',
  fontSize: '13px',
  fontFamily: "'DM Sans', sans-serif",
  outline: 'none',
  color: P.text,
  background: '#ffffff',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
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

export const WebsiteSettingsPage: React.FC = () => {
  const {
    settings,
    loading,
    saving,
    saveSettings,
    addHeroBanner,
    removeHeroBanner
  } = useWebsiteSettings()

  const [formData, setFormData] = useState(settings)
  const [newBannerUrl, setNewBannerUrl] = useState('')
  const [copiedSnippet, setCopiedSnippet] = useState(false)
  const [activeTab, setActiveTab] = useState<'cms' | 'checkout' | 'integration'>('cms')

  useEffect(() => {
    setFormData(settings)
  }, [settings])

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    await saveSettings(formData)
  }

  const handleAddBanner = async () => {
    if (!newBannerUrl.trim()) return
    await addHeroBanner(newBannerUrl.trim())
    setNewBannerUrl('')
  }

  const snippetCode = generateStorefrontSnippet()

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(snippetCode)
    setCopiedSnippet(true)
    toast.success('Integration code copied to clipboard! 📋')
    setTimeout(() => setCopiedSnippet(false), 2500)
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
              <Globe size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: P.text, margin: 0 }}>
                Website Store CMS & Integration
              </h1>
              <p style={{ fontSize: '13px', color: P.muted, margin: '2px 0 0 0' }}>
                Manage homepage hero banners, WhatsApp ordering, delivery rates, and connect your Claude website
              </p>
            </div>
          </div>

          <button
            onClick={() => handleSave()}
            disabled={saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '11px 22px',
              background: saving ? '#c084fc' : P.primary,
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(147,51,234,0.25)',
              transition: 'background 0.15s'
            }}
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          gap: '10px',
          borderBottom: `1px solid ${P.borderLight}`,
          marginBottom: '24px',
          paddingBottom: '2px'
        }}>
          {[
            { id: 'cms', label: 'Store CMS & Banners', icon: LayoutIcon },
            { id: 'checkout', label: 'WhatsApp & Delivery Config', icon: Truck },
            { id: 'integration', label: 'Claude Storefront Bridge & Code', icon: Code },
          ].map(t => {
            const isActive = activeTab === t.id
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  background: isActive ? P.light : 'transparent',
                  color: isActive ? P.primary : P.muted,
                  border: 'none',
                  borderBottom: isActive ? `3px solid ${P.primary}` : '3px solid transparent',
                  borderRadius: '8px 8px 0 0',
                  fontSize: '13px',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <Icon size={16} />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Tab 1: Store CMS & Banners */}
        {activeTab === 'cms' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)', gap: '24px' }}>
            {/* Left Column: Form Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Branding Section */}
              <div style={{
                background: 'white',
                borderRadius: P.radius,
                border: `1px solid ${P.borderLight}`,
                padding: '24px',
                boxShadow: P.shadowSm
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                  <Store size={18} color={P.primary} />
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: P.text, margin: 0 }}>
                    Store Branding & Header
                  </h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={labelStyle}>Store Name</label>
                    <input
                      style={inputStyle}
                      value={formData.store_name}
                      onChange={e => handleChange('store_name', e.target.value)}
                      placeholder="e.g. GSoft Fashion Store"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Tagline / Subheading</label>
                    <input
                      style={inputStyle}
                      value={formData.tagline || ''}
                      onChange={e => handleChange('tagline', e.target.value)}
                      placeholder="e.g. Boutique & Bridal Wear"
                    />
                  </div>
                </div>

                {/* Top Announcement Bar */}
                <div style={{
                  background: P.bg,
                  borderRadius: '12px',
                  border: `1px solid ${P.borderLight}`,
                  padding: '16px',
                  marginTop: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Top Announcement Bar</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: P.primary, fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={formData.show_announcement}
                        onChange={e => handleChange('show_announcement', e.target.checked)}
                        style={{ accentColor: P.primary, width: '16px', height: '16px' }}
                      />
                      Show on Website
                    </label>
                  </div>
                  <input
                    style={inputStyle}
                    value={formData.announcement_bar || ''}
                    onChange={e => handleChange('announcement_bar', e.target.value)}
                    placeholder="e.g. 🎉 Special Festive Sale! Free Delivery on orders above ₹999!"
                  />
                </div>

                {/* Theme Accent Color */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '18px' }}>
                  <Palette size={16} color={P.primary} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: P.text }}>Brand Color Accent:</span>
                  <input
                    type="color"
                    value={formData.theme_color || '#9333ea'}
                    onChange={e => handleChange('theme_color', e.target.value)}
                    style={{ width: '38px', height: '32px', borderRadius: '6px', border: `1px solid ${P.borderLight}`, cursor: 'pointer' }}
                  />
                  <span style={{ fontFamily: 'monospace', fontSize: '12px', color: P.muted, background: P.light, padding: '4px 8px', borderRadius: '6px' }}>
                    {formData.theme_color || '#9333ea'}
                  </span>
                </div>
              </div>

              {/* Hero Slider Banners */}
              <div style={{
                background: 'white',
                borderRadius: P.radius,
                border: `1px solid ${P.borderLight}`,
                padding: '24px',
                boxShadow: P.shadowSm
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                  <ImageIcon size={18} color={P.primary} />
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: P.text, margin: 0 }}>
                    Homepage Hero Slider Banners
                  </h3>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Hero Banner Heading</label>
                  <input
                    style={inputStyle}
                    value={formData.hero_title || ''}
                    onChange={e => handleChange('hero_title', e.target.value)}
                    placeholder="e.g. Exclusive Festive Collection 2026"
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Hero Subtitle / Description</label>
                  <textarea
                    rows={2}
                    style={{ ...inputStyle, resize: 'vertical' }}
                    value={formData.hero_subtitle || ''}
                    onChange={e => handleChange('hero_subtitle', e.target.value)}
                    placeholder="e.g. Discover trending designer kurtis, lehengas & western wear with instant delivery."
                  />
                </div>

                {/* Add New Banner URL */}
                <div style={{ borderTop: `1px solid ${P.borderLight}`, paddingTop: '16px', marginBottom: '16px' }}>
                  <label style={labelStyle}>Add New Banner Image (URL / CDN link)</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      style={{ ...inputStyle, flex: 1 }}
                      placeholder="https://images.unsplash.com/photo-... or cloud image URL"
                      value={newBannerUrl}
                      onChange={e => setNewBannerUrl(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleAddBanner}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '0 16px',
                        background: P.light,
                        color: P.primary,
                        border: `1px solid ${P.border}`,
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <Plus size={16} /> Add Banner
                    </button>
                  </div>
                </div>

                {/* Current Banner List */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
                  {(formData.hero_banners || []).map((url, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: 'relative',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        border: `1px solid ${P.borderLight}`,
                        height: '110px',
                        background: '#1a0a2e'
                      }}
                    >
                      <img
                        src={url}
                        alt={`Banner ${idx + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px'
                      }}>
                        <span style={{ color: 'white', fontSize: '11px', fontWeight: 700, background: 'rgba(0,0,0,0.5)', padding: '2px 8px', borderRadius: '4px' }}>
                          Slide #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeHeroBanner(idx)}
                          title="Remove Banner"
                          style={{
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Live Mock Storefront Preview */}
            <div>
              <div style={{
                background: 'white',
                borderRadius: P.radius,
                border: `1px solid ${P.borderLight}`,
                padding: '20px',
                boxShadow: P.shadowSm,
                position: 'sticky',
                top: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <Sparkles size={18} color="#f59e0b" />
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: P.text, margin: 0 }}>
                    Live Website Visual Preview
                  </h3>
                </div>

                {/* Mini Browser Frame */}
                <div style={{
                  border: `1px solid ${P.borderLight}`,
                  borderRadius: '14px',
                  overflow: 'hidden',
                  background: '#f8fafc',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.06)'
                }}>
                  {/* Browser top chrome */}
                  <div style={{
                    background: '#f1f5f9',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                    <div style={{
                      marginLeft: '8px',
                      background: 'white',
                      padding: '3px 10px',
                      borderRadius: '6px',
                      fontSize: '10px',
                      color: P.muted,
                      flex: 1,
                      fontFamily: 'monospace',
                      border: '1px solid #e2e8f0'
                    }}>
                      https://your-boutique.com
                    </div>
                  </div>

                  {/* Announcement Banner */}
                  {formData.show_announcement && (
                    <div style={{
                      background: formData.theme_color || '#9333ea',
                      color: 'white',
                      padding: '6px 12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      textAlign: 'center'
                    }}>
                      {formData.announcement_bar || 'Special Festive Offers!'}
                    </div>
                  )}

                  {/* Store Header */}
                  <div style={{
                    padding: '12px 16px',
                    background: 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #f1f5f9'
                  }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: P.text }}>{formData.store_name}</div>
                      <div style={{ fontSize: '10px', color: P.muted }}>{formData.tagline}</div>
                    </div>
                    <div style={{
                      background: P.light,
                      color: P.primary,
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '20px'
                    }}>
                      🛍️ Cart (0)
                    </div>
                  </div>

                  {/* Hero Banner Area */}
                  <div style={{
                    position: 'relative',
                    height: '160px',
                    background: '#1a0a2e',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'flex-end',
                    padding: '16px'
                  }}>
                    {formData.hero_banners?.[0] && (
                      <img
                        src={formData.hero_banners[0]}
                        alt="Hero"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          opacity: 0.6
                        }}
                      />
                    )}
                    <div style={{ position: 'relative', zIndex: 2, color: 'white' }}>
                      <div style={{ fontSize: '14px', fontWeight: 800, textShadow: '0 2px 4px rgba(0,0,0,0.6)' }}>
                        {formData.hero_title}
                      </div>
                      <div style={{ fontSize: '10px', color: '#f1f5f9', marginTop: '2px', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                        {formData.hero_subtitle}
                      </div>
                      <button
                        type="button"
                        style={{
                          marginTop: '8px',
                          background: formData.theme_color || '#9333ea',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '10px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Explore Catalog →
                      </button>
                    </div>
                  </div>

                  {/* Footer note */}
                  <div style={{ padding: '10px', textAlign: 'center', fontSize: '10px', color: P.muted, background: 'white' }}>
                    ⚡ Real-time stock synced with GSoft Retail ERP
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: WhatsApp & Delivery Config */}
        {activeTab === 'checkout' && (
          <div style={{
            background: 'white',
            borderRadius: P.radius,
            border: `1px solid ${P.borderLight}`,
            padding: '28px',
            maxWidth: '700px',
            boxShadow: P.shadowSm
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '22px' }}>
              <MessageSquare size={18} color={P.primary} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: P.text, margin: 0 }}>
                WhatsApp Direct Ordering & Delivery Rules
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={labelStyle}>WhatsApp Business Phone (with country code)</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={16} color={P.muted} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    style={{ ...inputStyle, paddingLeft: '36px', fontFamily: 'monospace', fontWeight: 600 }}
                    placeholder="919876543210"
                    value={formData.whatsapp_number}
                    onChange={e => handleChange('whatsapp_number', e.target.value)}
                  />
                </div>
                <div style={{ fontSize: '11px', color: P.muted, marginTop: '4px' }}>
                  Customers clicking &quot;Order via WhatsApp&quot; on your website will send order summaries directly to this number.
                </div>
              </div>

              {/* Toggles */}
              <div style={{
                background: P.bg,
                border: `1px solid ${P.borderLight}`,
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: P.text }}>Enable 1-Click WhatsApp Ordering</div>
                  <div style={{ fontSize: '11px', color: P.muted }}>Allow shoppers to place instant orders without paying through card payment gateways</div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.enable_whatsapp_checkout}
                  onChange={e => handleChange('enable_whatsapp_checkout', e.target.checked)}
                  style={{ accentColor: P.primary, width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>

              <div style={{
                background: P.bg,
                border: `1px solid ${P.borderLight}`,
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: P.text }}>Allow Cash on Delivery (COD)</div>
                  <div style={{ fontSize: '11px', color: P.muted }}>Enable cash payment on home delivery option on website checkout</div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.enable_cod}
                  onChange={e => handleChange('enable_cod', e.target.checked)}
                  style={{ accentColor: P.primary, width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>

              {/* Delivery Rates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Standard Delivery Fee (₹)</label>
                  <input
                    type="number"
                    style={inputStyle}
                    value={formData.standard_delivery_fee}
                    onChange={e => handleChange('standard_delivery_fee', Number(e.target.value))}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Free Delivery Minimum Order (₹)</label>
                  <input
                    type="number"
                    style={inputStyle}
                    value={formData.min_order_free_shipping}
                    onChange={e => handleChange('min_order_free_shipping', Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Store Address */}
              <div>
                <label style={labelStyle}>Store / Dispatch Address</label>
                <textarea
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  value={formData.contact_address || ''}
                  onChange={e => handleChange('contact_address', e.target.value)}
                  placeholder="e.g. Shop 102, Shivalik Plaza, Ambawadi, Ahmedabad, Gujarat - 380015"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={saving}
                  style={{
                    padding: '11px 24px',
                    background: P.primary,
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(147,51,234,0.2)'
                  }}
                >
                  {saving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Claude Storefront Bridge Code */}
        {activeTab === 'integration' && (
          <div style={{
            background: 'white',
            borderRadius: P.radius,
            border: `1px solid ${P.borderLight}`,
            padding: '28px',
            maxWidth: '900px',
            boxShadow: P.shadowSm
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Code size={20} color={P.primary} />
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: P.text, margin: 0 }}>
                    Claude Website Integration Script
                  </h3>
                </div>
                <p style={{ fontSize: '13px', color: P.muted, margin: '4px 0 0 0' }}>
                  Drop this script into your Claude-built website to automatically synchronize live products & stock.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopySnippet}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
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
                {copiedSnippet ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                {copiedSnippet ? 'Copied to Clipboard!' : 'Copy Code Snippet'}
              </button>
            </div>

            {/* Quick 3 Steps */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
              <div style={{ background: P.bg, borderRadius: '12px', padding: '14px', border: `1px solid ${P.borderLight}` }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: P.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, marginBottom: '8px' }}>
                  1
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: P.text }}>Add Script Tag</div>
                <div style={{ fontSize: '11px', color: P.muted, marginTop: '2px' }}>
                  Paste before the closing <code>&lt;/body&gt;</code> in your website HTML.
                </div>
              </div>

              <div style={{ background: P.bg, borderRadius: '12px', padding: '14px', border: `1px solid ${P.borderLight}` }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: P.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, marginBottom: '8px' }}>
                  2
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: P.text }}>Fetch Catalog</div>
                <div style={{ fontSize: '11px', color: P.muted, marginTop: '2px' }}>
                  Call <code>GSoftStore.getProducts()</code> to load live catalog & stock.
                </div>
              </div>

              <div style={{ background: P.bg, borderRadius: '12px', padding: '14px', border: `1px solid ${P.borderLight}` }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: P.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, marginBottom: '8px' }}>
                  3
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: P.text }}>Submit Orders</div>
                <div style={{ fontSize: '11px', color: P.muted, marginTop: '2px' }}>
                  Call <code>GSoftStore.createOrder(data)</code> to route web orders straight into ERP.
                </div>
              </div>
            </div>

            {/* Code container */}
            <div style={{
              background: '#0f172a',
              borderRadius: '12px',
              padding: '16px',
              overflowX: 'auto',
              border: '1px solid #1e293b'
            }}>
              <pre style={{
                margin: 0,
                color: '#e2e8f0',
                fontFamily: "'DM Mono', monospace",
                fontSize: '12px',
                lineHeight: 1.6
              }}>
                <code>{snippetCode}</code>
              </pre>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
export default WebsiteSettingsPage
