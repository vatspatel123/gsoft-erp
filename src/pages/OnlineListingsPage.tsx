import { useState } from 'react'
import { Layout } from '../components/shared/Layout'
import { useOnlineStore, type OnlineProduct } from '../hooks/useOnlineStore'
import {
  Globe, Search, Star, Flame, Eye, Check, X,
  ShoppingBag, Tag, RefreshCw, ExternalLink,
  Plus, Image as ImageIcon, Layers, AlertCircle
} from 'lucide-react'

export function OnlineListingsPage() {
  const store = useOnlineStore()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [previewProduct, setPreviewProduct] = useState<OnlineProduct | null>(null)
  const [editListingModal, setEditListingModal] = useState<OnlineProduct | null>(null)

  // Edit modal states
  const [editTitle, setEditTitle] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editDiscount, setEditDiscount] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editPhotoInput, setEditPhotoInput] = useState('')
  const [editPhotos, setEditPhotos] = useState<string[]>([])

  const openEditModal = (p: OnlineProduct) => {
    setEditListingModal(p)
    setEditTitle(p.online_title || p.name)
    setEditPrice(p.online_price?.toString() || p.unit_price?.toString() || '')
    setEditDiscount(p.online_discount_pct?.toString() || '0')
    setEditCategory(p.online_category || '')
    setEditDescription(p.online_description || '')
    setEditTags(p.tags || '')
    setEditPhotos(p.photos && p.photos.length > 0 ? p.photos : (p.photo_url ? [p.photo_url] : []))
    setEditPhotoInput('')
  }

  const handleSaveListingDetails = async () => {
    if (!editListingModal) return
    await store.updateOnlineDetails(editListingModal.id, {
      online_title: editTitle.trim(),
      online_price: editPrice ? parseFloat(editPrice) : editListingModal.unit_price,
      online_discount_pct: editDiscount ? parseFloat(editDiscount) : 0,
      online_category: editCategory.trim(),
      online_description: editDescription.trim(),
      tags: editTags.trim(),
      photos: editPhotos
    })
    setEditListingModal(null)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.length === store.products.length ? [] : store.products.map(p => p.id))
  }

  return (
    <Layout>
      <div style={{ padding: '24px', background: '#fdf8ff', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#9333ea', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Globe size={18} />
              </div>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1a0a2e', margin: 0 }}>Website Store Listings</h1>
            </div>
            <p style={{ margin: '4px 0 0 40px', fontSize: '13px', color: '#64748b' }}>
              Control which ERP products appear on your customer website with 100% unified real-time stock sync.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={() => store.loadProducts()}
              style={{ padding: '9px 14px', background: 'white', border: '1px solid #f3e8ff', borderRadius: '10px', fontSize: '12px', fontWeight: 600, color: '#9333ea', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={13} /> Refresh Stock
            </button>
            <a
              href="/website-settings"
              style={{ padding: '9px 16px', background: '#9333ea', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              🎨 Storefront Settings
            </a>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
          {[
            { label: 'Live on Website', value: store.stats.online, icon: Globe, color: '#16a34a', bg: '#f0fdf4' },
            { label: 'In-Store Only (Draft)', value: store.stats.draft, icon: Layers, color: '#64748b', bg: '#f8fafc' },
            { label: 'Featured on Homepage', value: store.stats.featured, icon: Star, color: '#eab308', bg: '#fefce8' },
            { label: 'Out of Stock on Web', value: store.stats.outOfStock, icon: AlertCircle, color: '#ef4444', bg: '#fef2f2' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', border: '1px solid #f3e8ff', borderRadius: '14px', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
                <s.icon size={20} />
              </div>
              <div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: s.color, fontFamily: 'DM Mono, monospace' }}>{s.value}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
          {[
            { id: 'all', label: `All Products (${store.stats.total})` },
            { id: 'online', label: `🌐 Live on Website (${store.stats.online})` },
            { id: 'draft', label: `📦 In-Store Only (${store.stats.draft})` },
            { id: 'featured', label: `⭐ Featured (${store.stats.featured})` },
            { id: 'bestseller', label: `🔥 Bestsellers (${store.stats.bestseller})` },
            { id: 'out_of_stock', label: `⚠️ Out of Stock (${store.stats.outOfStock})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => store.setStatusFilter(tab.id as any)}
              style={{
                padding: '7px 14px',
                borderRadius: '99px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                border: store.statusFilter === tab.id ? 'none' : '1px solid #f3e8ff',
                background: store.statusFilter === tab.id ? '#9333ea' : 'white',
                color: store.statusFilter === tab.id ? 'white' : '#64748b',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Bulk Bar */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9333ea' }} />
            <input
              type="text"
              placeholder="Search by product name, SKU, design no, or tag..."
              value={store.search}
              onChange={e => store.setSearch(e.target.value)}
              style={{
                width: '100%', border: '1px solid #f3e8ff', borderRadius: '10px',
                padding: '9px 12px 9px 34px', fontSize: '13px', outline: 'none',
                background: 'white', color: '#1a0a2e'
              }}
            />
          </div>

          {selectedIds.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#f5f3ff', border: '1px solid #e9d5ff', borderRadius: '10px', padding: '4px 10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#9333ea' }}>{selectedIds.length} selected:</span>
              <button
                onClick={() => { store.bulkPublish(selectedIds, true); setSelectedIds([]) }}
                style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
              >
                ✓ Publish to Web
              </button>
              <button
                onClick={() => { store.bulkPublish(selectedIds, false); setSelectedIds([]) }}
                style={{ background: '#64748b', color: 'white', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
              >
                ✕ Move to Draft
              </button>
            </div>
          )}

          <button
            onClick={toggleSelectAll}
            style={{ padding: '8px 12px', background: 'white', border: '1px solid #f3e8ff', borderRadius: '8px', fontSize: '12px', fontWeight: 500, color: '#64748b', cursor: 'pointer' }}
          >
            {selectedIds.length === store.products.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {/* Listings Grid */}
        {store.loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#9333ea', fontWeight: 600 }}>
            Loading store listings...
          </div>
        ) : store.products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: 'white', borderRadius: '16px', border: '1px dashed #e9d5ff' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>🛍️</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#1a0a2e' }}>No products match this filter</div>
            <p style={{ fontSize: '13px', color: '#94a3b8', maxWidth: '360px', margin: '6px auto 16px' }}>
              Try adjusting your search query or publish products to make them visible on the customer website.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {store.products.map(p => {
              const isSelected = selectedIds.includes(p.id)
              const hasPhoto = p.photos && p.photos.length > 0 ? p.photos[0] : p.photo_url
              const isOut = p.stock_qty <= 0

              return (
                <div
                  key={p.id}
                  style={{
                    background: 'white',
                    border: isSelected ? '2px solid #9333ea' : '1px solid #f3e8ff',
                    borderRadius: '16px',
                    padding: '14px',
                    boxShadow: '0 4px 16px rgba(147, 51, 234, 0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative'
                  }}
                >
                  {/* Select Checkbox */}
                  <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 10 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(p.id)}
                      style={{ width: '16px', height: '16px', accentColor: '#9333ea', cursor: 'pointer' }}
                    />
                  </div>

                  {/* Top Image Preview & Status Badges */}
                  <div>
                    <div style={{
                      height: '140px',
                      background: '#faf5ff',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '12px',
                      position: 'relative'
                    }}>
                      {hasPhoto ? (
                        <img
                          src={hasPhoto}
                          alt={p.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ textAlign: 'center', color: '#c084fc' }}>
                          <ImageIcon size={32} style={{ margin: '0 auto 4px', display: 'block' }} />
                          <span style={{ fontSize: '11px' }}>No Photo</span>
                        </div>
                      )}

                      {/* Online status indicator badge */}
                      <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '99px',
                          background: p.is_online ? '#dcfce7' : '#f1f5f9',
                          color: p.is_online ? '#166534' : '#64748b',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                        }}>
                          {p.is_online ? '🌐 Live' : 'Draft'}
                        </span>
                      </div>
                    </div>

                    {/* Title & SKU */}
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#1a0a2e', marginBottom: '2px' }}>
                      {p.online_title || p.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'DM Mono, monospace', marginBottom: '8px' }}>
                      {[p.design_no, p.size, p.colour, p.sku].filter(Boolean).join(' · ')}
                    </div>

                    {/* Stock & Badges */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '6px',
                        background: isOut ? '#fef2f2' : p.stock_qty <= 5 ? '#fff7ed' : '#f0fdf4',
                        color: isOut ? '#dc2626' : p.stock_qty <= 5 ? '#c2410c' : '#16a34a',
                      }}>
                        {isOut ? 'Out of Stock (Web)' : `In Stock: ${p.stock_qty}`}
                      </span>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => store.toggleFeatured(p.id)}
                          title="Toggle Featured on Homepage"
                          style={{
                            background: p.is_featured ? '#fef08a' : '#f8fafc',
                            border: `1px solid ${p.is_featured ? '#eab308' : '#e2e8f0'}`,
                            borderRadius: '6px', padding: '3px 6px', cursor: 'pointer',
                            color: p.is_featured ? '#854d0e' : '#94a3b8', fontSize: '11px', fontWeight: 600
                          }}
                        >
                          ⭐
                        </button>
                        <button
                          onClick={() => store.toggleBestseller(p.id)}
                          title="Toggle Bestseller Badge"
                          style={{
                            background: p.is_bestseller ? '#ffedd5' : '#f8fafc',
                            border: `1px solid ${p.is_bestseller ? '#f97316' : '#e2e8f0'}`,
                            borderRadius: '6px', padding: '3px 6px', cursor: 'pointer',
                            color: p.is_bestseller ? '#9a3412' : '#94a3b8', fontSize: '11px', fontWeight: 600
                          }}
                        >
                          🔥
                        </button>
                      </div>
                    </div>

                    {/* Price comparison */}
                    <div style={{ background: '#faf5ff', borderRadius: '8px', padding: '6px 10px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '10px', color: '#9333ea', fontWeight: 600 }}>WEB PRICE</div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: '#1a0a2e', fontFamily: 'DM Mono, monospace' }}>
                          ₹{Number(p.online_price || p.unit_price).toFixed(0)}
                        </div>
                      </div>
                      {p.mrp && p.mrp > (p.online_price || p.unit_price) && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '10px', color: '#94a3b8' }}>MRP</div>
                          <div style={{ fontSize: '12px', color: '#94a3b8', textDecoration: 'line-through', fontFamily: 'DM Mono, monospace' }}>
                            ₹{p.mrp}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '6px' }}>
                    <button
                      onClick={() => store.toggleOnlineStatus(p.id)}
                      style={{
                        background: p.is_online ? '#fef2f2' : '#9333ea',
                        color: p.is_online ? '#dc2626' : 'white',
                        border: 'none', borderRadius: '8px', padding: '7px 10px',
                        fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                      }}
                    >
                      {p.is_online ? 'Unpublish' : 'Publish to Web'}
                    </button>
                    <button
                      onClick={() => openEditModal(p)}
                      title="Edit Online Listing details"
                      style={{
                        background: 'white', border: '1px solid #f3e8ff',
                        borderRadius: '8px', padding: '7px 10px', fontSize: '12px',
                        color: '#9333ea', cursor: 'pointer', fontWeight: 600
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setPreviewProduct(p)}
                      title="Preview on Website Mockup"
                      style={{
                        background: 'white', border: '1px solid #f3e8ff',
                        borderRadius: '8px', padding: '7px 10px', fontSize: '12px',
                        color: '#64748b', cursor: 'pointer'
                      }}
                    >
                      <Eye size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ─── MODAL 1: EDIT ONLINE LISTING ─────────────────────────────────── */}
        {editListingModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
            <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid #f3e8ff' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#9333ea', textTransform: 'uppercase' }}>Edit Online Listing</div>
                  <h3 style={{ margin: 0, fontSize: '17px', color: '#1a0a2e' }}>{editListingModal.name}</h3>
                </div>
                <button onClick={() => setEditListingModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>CUSTOMER-FACING WEBSITE TITLE</label>
                  <input
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    placeholder="e.g. Premium Silk Anarkali Suit with Dupatta"
                    style={{ width: '100%', border: '1px solid #f3e8ff', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>ONLINE SELLING PRICE (₹)</label>
                    <input
                      type="number"
                      value={editPrice}
                      onChange={e => setEditPrice(e.target.value)}
                      placeholder="e.g. 1499"
                      style={{ width: '100%', border: '1px solid #f3e8ff', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>WEBSITE CATEGORY</label>
                    <input
                      value={editCategory}
                      onChange={e => setEditCategory(e.target.value)}
                      placeholder="e.g. Festive Kurti / Saree"
                      style={{ width: '100%', border: '1px solid #f3e8ff', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>PRODUCT DESCRIPTION & FABRIC DETAILS</label>
                  <textarea
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    rows={3}
                    placeholder="Describe fabric, occasion, fit, wash care instructions..."
                    style={{ width: '100%', border: '1px solid #f3e8ff', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>PRODUCT IMAGES GALLERY (URLS)</label>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                    <input
                      value={editPhotoInput}
                      onChange={e => setEditPhotoInput(e.target.value)}
                      placeholder="Paste image URL (https://...)"
                      style={{ flex: 1, border: '1px solid #f3e8ff', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', outline: 'none' }}
                    />
                    <button
                      onClick={() => {
                        if (editPhotoInput.trim()) {
                          setEditPhotos([...editPhotos, editPhotoInput.trim()])
                          setEditPhotoInput('')
                        }
                      }}
                      style={{ background: '#9333ea', color: 'white', border: 'none', borderRadius: '8px', padding: '0 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      + Add Photo
                    </button>
                  </div>

                  {editPhotos.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {editPhotos.map((url, idx) => (
                        <div key={idx} style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                          <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button
                            onClick={() => setEditPhotos(editPhotos.filter((_, i) => i !== idx))}
                            style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px' }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>SEARCH TAGS</label>
                  <input
                    value={editTags}
                    onChange={e => setEditTags(e.target.value)}
                    placeholder="e.g. partywear, wedding, trending, pure-cotton"
                    style={{ width: '100%', border: '1px solid #f3e8ff', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                <button
                  onClick={handleSaveListingDetails}
                  style={{ flex: 1, padding: '10px', background: '#9333ea', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Listing
                </button>
                <button
                  onClick={() => setEditListingModal(null)}
                  style={{ padding: '10px 18px', background: 'white', border: '1px solid #f3e8ff', borderRadius: '10px', fontSize: '13px', fontWeight: 600, color: '#64748b', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL 2: WEBSITE CUSTOMER VIEW PREVIEW ───────────────────────── */}
        {previewProduct && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
            <div style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '400px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
              <div style={{ padding: '12px 16px', background: '#9333ea', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700 }}>👁️ Website Customer Mockup View</span>
                <button onClick={() => setPreviewProduct(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={16} /></button>
              </div>

              <div style={{ height: '240px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {previewProduct.photos?.[0] || previewProduct.photo_url ? (
                  <img src={previewProduct.photos?.[0] || previewProduct.photo_url || ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ color: '#94a3b8', fontSize: '13px' }}>No Product Image</div>
                )}
                {previewProduct.is_bestseller && (
                  <span style={{ position: 'absolute', top: '12px', left: '12px', background: '#ea580c', color: 'white', fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '99px' }}>
                    🔥 BESTSELLER
                  </span>
                )}
              </div>

              <div style={{ padding: '16px' }}>
                <div style={{ fontSize: '11px', color: '#9333ea', fontWeight: 700, textTransform: 'uppercase' }}>
                  {previewProduct.online_category || 'Fashion & Apparel'}
                </div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#1a0a2e', margin: '4px 0 6px' }}>
                  {previewProduct.online_title || previewProduct.name}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '20px', fontWeight: 800, color: '#1a0a2e', fontFamily: 'DM Mono, monospace' }}>
                    ₹{Number(previewProduct.online_price || previewProduct.unit_price).toFixed(0)}
                  </span>
                  {previewProduct.mrp && previewProduct.mrp > (previewProduct.online_price || previewProduct.unit_price) && (
                    <span style={{ fontSize: '14px', color: '#94a3b8', textDecoration: 'line-through', fontFamily: 'DM Mono, monospace' }}>
                      ₹{previewProduct.mrp}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px', lineHeight: 1.4 }}>
                  {previewProduct.online_description || 'High quality material designed for comfort and style. Available for instant dispatch.'}
                </div>

                <button
                  disabled={previewProduct.stock_qty <= 0}
                  style={{
                    width: '100%', padding: '12px',
                    background: previewProduct.stock_qty > 0 ? '#9333ea' : '#94a3b8',
                    color: 'white', border: 'none', borderRadius: '12px', fontSize: '13px',
                    fontWeight: 700, cursor: previewProduct.stock_qty > 0 ? 'pointer' : 'not-allowed'
                  }}
                >
                  {previewProduct.stock_qty > 0 ? '🛍️ Add to Cart / Buy Now' : 'Out of Stock'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  )
}
