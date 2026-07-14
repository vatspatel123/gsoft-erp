import { useState, useEffect } from 'react'
import { X, Camera } from 'lucide-react'
import { SIZES, COLOUR_PILLS, colourToCSS, autoGenerateBatch } from '../../utils/design'

interface ProductFormProps {
  product?: any
  categories: any[]
  onSave: (data: any, editId?: string) => Promise<boolean>
  onAddCategory: (name: string) => Promise<any>
  onClose: () => void
}

const HSN_CHIPS = [
  { code: '6204', label: "Women's suits/dresses" },
  { code: '6205', label: "Men's shirts" },
  { code: '6206', label: "Women's blouses" },
  { code: '6207', label: "Men's singlets" },
  { code: '6211', label: 'Track suits/swimwear' },
  { code: '6214', label: 'Shawls/scarves/dupatta' },
]

export function ProductForm({ product, categories, onSave, onAddCategory, onClose }: ProductFormProps) {
  const [name, setName] = useState(product?.name || '')
  const [sku, setSku] = useState(product?.sku || '')
  const [barcode, setBarcode] = useState(product?.barcode || '')
  const [unitPrice, setUnitPrice] = useState(product?.unit_price?.toString() || '')
  const [costPrice, setCostPrice] = useState(product?.cost_price?.toString() || '')
  const [gstRate, setGstRate] = useState(product?.gst_rate?.toString() || '18')
  const [categoryId, setCategoryId] = useState(product?.category_id || '')
  const [stockQty, setStockQty] = useState(product?.stock_qty?.toString() || '0')
  const [lowStockAlert, setLowStockAlert] = useState(product?.low_stock_alert?.toString() || '5')
  const [unit, setUnit] = useState(product?.unit || 'piece')
  const [brand, setBrand] = useState(product?.brand || '')
  const [description, setDescription] = useState(product?.description || '')
  const [isActive, setIsActive] = useState(product?.is_active ?? true)
  const [photoUrl, setPhotoUrl] = useState(product?.photo_url || '')
  const [saving, setSaving] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [showNewCat, setShowNewCat] = useState(false)

  // Fashion fields
  const [designNo, setDesignNo] = useState(product?.design_no || '')
  const [pcode, setPcode] = useState(product?.pcode || '')
  const [size, setSize] = useState(product?.size || '')
  const [customSize, setCustomSize] = useState('')
  const [colour, setColour] = useState(product?.colour || '')
  const [mrp, setMrp] = useState(product?.mrp?.toString() || '')
  const [batchNo, setBatchNo] = useState(product?.batch_no || '')
  const [hsnCode, setHsnCode] = useState(product?.hsn_code || '')

  // If editing and size is not in standard list, pre-fill customSize
  useEffect(() => {
    if (product?.size && !SIZES.slice(0, -1).includes(product.size)) {
      setSize('Custom')
      setCustomSize(product.size)
    }
  }, [])

  const finalSize = size === 'Custom' ? customSize : size

  const margin = unitPrice && costPrice
    ? (((parseFloat(unitPrice) - parseFloat(costPrice)) / parseFloat(unitPrice)) * 100).toFixed(1)
    : '—'

  const autoSku = () => setSku('SKU-' + Date.now().toString().slice(-6))

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhotoUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSave = async (keepOpen = false) => {
    if (!name.trim()) return
    if (!sku.trim()) return
    if (!unitPrice) return
    setSaving(true)

    let finalCategoryId = categoryId
    if (showNewCat && newCatName.trim()) {
      const cat = await onAddCategory(newCatName.trim())
      if (cat) finalCategoryId = cat.id
    }

    // Auto-generate barcode if empty
    const autoBarcode =
      barcode.trim() ||
      (batchNo.trim() && /^\d+$/.test(batchNo.trim()) ? batchNo.trim().padStart(8, '0') : '') ||
      sku.trim().replace(/\D/g, '').padStart(8, '0') ||
      Date.now().toString().slice(-8)

    const data: any = {
      name: name.trim(),
      sku: sku.trim(),
      barcode: autoBarcode || null,
      unit_price: parseFloat(unitPrice),
      cost_price: costPrice ? parseFloat(costPrice) : null,
      gst_rate: parseFloat(gstRate),
      category_id: finalCategoryId || null,
      stock_qty: parseInt(stockQty) || 0,
      low_stock_alert: parseInt(lowStockAlert) || 5,
      unit: unit || 'piece',
      brand: brand.trim() || null,
      description: description.trim() || null,
      is_active: isActive,
      photo_url: photoUrl || null,
      design_no: designNo.trim() || null,
      pcode: pcode.trim() || null,
      size: finalSize.trim() || null,
      colour: colour.trim() || null,
      mrp: mrp ? parseFloat(mrp) : null,
      batch_no: batchNo.trim() || null,
      hsn_code: hsnCode.trim() || null,
    }

    const ok = await onSave(data, product?.id)
    setSaving(false)
    if (ok && !keepOpen) onClose()
  }

  // Styles
  const overlayStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.45)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px'
  }
  const cardStyle: React.CSSProperties = {
    background: 'white', borderRadius: '20px', width: '100%', maxWidth: '600px',
    maxHeight: '90vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', border: '1px solid #f3e8ff', borderRadius: '10px',
    padding: '10px 14px', fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
    outline: 'none', color: '#1a0a2e', background: 'white'
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '11px', fontWeight: 600, color: '#9333ea',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block'
  }
  const sectionStyle: React.CSSProperties = {
    marginBottom: '20px'
  }
  const gridTwoStyle: React.CSSProperties = {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'
  }
  const gridThreeStyle: React.CSSProperties = {
    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px'
  }
  const helperStyle: React.CSSProperties = {
    fontSize: '10px', color: '#94a3b8', marginTop: '3px'
  }
  const fashionSectionStyle: React.CSSProperties = {
    background: '#fdf8ff', border: '1px solid #f3e8ff', borderRadius: '12px',
    padding: '16px', marginBottom: '16px'
  }
  const fashionLabelStyle: React.CSSProperties = {
    fontSize: '11px', fontWeight: 600, color: '#9333ea',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px',
    display: 'flex', alignItems: 'center', gap: '8px'
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={cardStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '24px 28px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#1a0a2e' }}>
              {product ? 'Edit Product' : 'Add New Product'}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
              Fill in product details
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: '20px 28px 28px', overflowY: 'auto', flex: 1 }}>

          {/* Photo Upload */}
          <div style={sectionStyle}>
            <label style={{ ...inputStyle, border: '2px dashed #e9d5ff', background: '#fdf8ff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100px', cursor: 'pointer', borderRadius: '12px', gap: '6px' }}>
              {photoUrl ? (
                <img src={photoUrl} alt="Preview" style={{ height: '80px', borderRadius: '8px', objectFit: 'cover' }} />
              ) : (
                <>
                  <Camera size={24} color="#c084fc" />
                  <span style={{ fontSize: '12px', color: '#9333ea', fontWeight: 500 }}>Upload Photo</span>
                </>
              )}
              <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
            </label>
          </div>

          {/* Basic Info */}
          <div style={sectionStyle}>
            <label style={labelStyle}>Product Name *</label>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cotton T-Shirt" />
          </div>

          <div style={{ ...gridTwoStyle, ...sectionStyle }}>
            <div>
              <label style={labelStyle}>SKU / Code *</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input style={{ ...inputStyle, flex: 1 }} value={sku} onChange={e => setSku(e.target.value)} placeholder="SKU-XXXX" />
                <button onClick={autoSku} style={{ padding: '0 10px', background: '#f5f3ff', border: '1px solid #f3e8ff', borderRadius: '10px', color: '#9333ea', fontSize: '11px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>Auto</button>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Barcode</label>
              <input style={inputStyle} value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Scan or type" />
            </div>
          </div>

          {/* Fashion Details Section */}
          <div style={fashionSectionStyle}>
            <div style={fashionLabelStyle}>
              Fashion Details
              <span style={{ fontSize: '10px', fontWeight: 500, background: '#f3e8ff', color: '#9333ea', padding: '2px 8px', borderRadius: '99px', textTransform: 'none', letterSpacing: 0 }}>Optional</span>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '12px', marginTop: '-6px' }}>
              Size, colour and design info for fashion items
            </div>

            {/* Row 1: Design No + PCode */}
            <div style={{ ...gridTwoStyle, marginBottom: '12px' }}>
              <div>
                <label style={labelStyle}>Design No</label>
                <input style={inputStyle} value={designNo} onChange={e => setDesignNo(e.target.value)} placeholder="e.g. 31, 803125" />
                <div style={helperStyle}>Design number from supplier</div>
              </div>
              <div>
                <label style={labelStyle}>P.Code</label>
                <input style={inputStyle} value={pcode} onChange={e => setPcode(e.target.value)} placeholder="e.g. 24, 83" />
                <div style={helperStyle}>Supplier product code</div>
              </div>
            </div>

            {/* Row 2: Size + Colour */}
            <div style={{ ...gridTwoStyle, marginBottom: '12px' }}>
              <div>
                <label style={labelStyle}>Size</label>
                <select
                  style={inputStyle}
                  value={size}
                  onChange={e => { setSize(e.target.value); if (e.target.value !== 'Custom') setCustomSize('') }}
                >
                  <option value="">Select size</option>
                  {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {size === 'Custom' && (
                  <input
                    style={{ ...inputStyle, marginTop: '6px' }}
                    value={customSize}
                    onChange={e => setCustomSize(e.target.value)}
                    placeholder="Type custom size"
                    autoFocus
                  />
                )}
              </div>
              <div>
                <label style={labelStyle}>Colour</label>
                <div style={{ position: 'relative' }}>
                  {colour && (
                    <div style={{
                      position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                      width: '12px', height: '12px', borderRadius: '50%',
                      background: colourToCSS(colour), border: '1px solid rgba(0,0,0,0.1)', zIndex: 1
                    }} />
                  )}
                  <input
                    style={{ ...inputStyle, paddingLeft: colour ? '32px' : '14px' }}
                    value={colour}
                    onChange={e => setColour(e.target.value)}
                    placeholder="e.g. Red, Navy Blue"
                  />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                  {COLOUR_PILLS.map(c => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setColour(c.name)}
                      title={c.name}
                      style={{
                        width: '18px', height: '18px', borderRadius: '50%', border: colour === c.name ? '2px solid #9333ea' : '1px solid rgba(0,0,0,0.15)',
                        background: c.css, cursor: 'pointer', padding: 0,
                        boxShadow: colour === c.name ? '0 0 0 2px white, 0 0 0 4px #9333ea' : 'none'
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Row 3: MRP + Batch No */}
            <div style={{ ...gridTwoStyle, marginBottom: '12px' }}>
              <div>
                <label style={labelStyle}>MRP ₹</label>
                <input style={inputStyle} type="number" value={mrp} onChange={e => setMrp(e.target.value)} placeholder="0.00" />
                <div style={helperStyle}>Printed on barcode label</div>
              </div>
              <div>
                <label style={labelStyle}>Batch No</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input style={{ ...inputStyle, flex: 1 }} value={batchNo} onChange={e => setBatchNo(e.target.value)} placeholder="Auto or enter batch" />
                  <button
                    type="button"
                    onClick={() => setBatchNo(autoGenerateBatch())}
                    style={{ padding: '0 10px', background: '#f5f3ff', border: '1px solid #f3e8ff', borderRadius: '10px', color: '#9333ea', fontSize: '11px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >Auto</button>
                </div>
                <div style={helperStyle}>For stock tracking</div>
              </div>
            </div>

            {/* Row 4: HSN Code + Brand */}
            <div style={gridTwoStyle}>
              <div>
                <label style={labelStyle}>HSN Code</label>
                <input
                  style={inputStyle}
                  value={hsnCode}
                  onChange={e => setHsnCode(e.target.value)}
                  placeholder="e.g. 6204, 6205"
                  maxLength={8}
                />
                <div style={helperStyle}>Required for GST</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                  {HSN_CHIPS.map(h => (
                    <button
                      key={h.code}
                      type="button"
                      onClick={() => setHsnCode(h.code)}
                      title={h.label}
                      style={{
                        padding: '2px 7px', fontSize: '10px', fontWeight: 600,
                        background: hsnCode === h.code ? '#9333ea' : '#f5f3ff',
                        color: hsnCode === h.code ? 'white' : '#9333ea',
                        border: '1px solid #e9d5ff', borderRadius: '99px', cursor: 'pointer',
                        fontFamily: 'DM Mono, monospace'
                      }}
                    >{h.code}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Brand / Label</label>
                <input style={inputStyle} value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. FabIndia, BIBA" />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div style={{ ...gridThreeStyle, ...sectionStyle }}>
            <div>
              <label style={labelStyle}>Selling Price ₹ *</label>
              <input style={inputStyle} type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label style={labelStyle}>Cost Price ₹</label>
              <input style={inputStyle} type="number" value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label style={labelStyle}>Margin %</label>
              <input style={{ ...inputStyle, background: '#fdf8ff', color: '#9333ea', fontWeight: 600 }} value={margin} readOnly />
            </div>
          </div>

          {/* Tax & Category */}
          <div style={{ ...gridTwoStyle, ...sectionStyle }}>
            <div>
              <label style={labelStyle}>GST Rate</label>
              <select style={inputStyle} value={gstRate} onChange={e => setGstRate(e.target.value)}>
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              {!showNewCat ? (
                <select style={inputStyle} value={categoryId} onChange={e => {
                  if (e.target.value === '__new__') { setShowNewCat(true); setCategoryId('') }
                  else setCategoryId(e.target.value)
                }}>
                  <option value="">No category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="__new__">+ Add New Category</option>
                </select>
              ) : (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input style={{ ...inputStyle, flex: 1 }} value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Category name" autoFocus />
                  <button onClick={() => { setShowNewCat(false); setNewCatName('') }} style={{ padding: '0 8px', background: 'none', border: '1px solid #f3e8ff', borderRadius: '10px', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}>✕</button>
                </div>
              )}
            </div>
          </div>

          {/* Inventory */}
          <div style={{ ...gridTwoStyle, ...sectionStyle }}>
            <div>
              <label style={labelStyle}>Opening Stock</label>
              <input style={inputStyle} type="number" value={stockQty} onChange={e => setStockQty(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Low Stock Alert</label>
              <input style={inputStyle} type="number" value={lowStockAlert} onChange={e => setLowStockAlert(e.target.value)} />
              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '3px' }}>Alert when below this</div>
            </div>
          </div>

          {/* Unit + Description */}
          <div style={{ ...gridTwoStyle, ...sectionStyle }}>
            <div>
              <label style={labelStyle}>Unit</label>
              <select style={inputStyle} value={unit} onChange={e => setUnit(e.target.value)}>
                <option value="piece">Piece</option>
                <option value="kg">Kg</option>
                <option value="litre">Litre</option>
                <option value="metre">Metre</option>
                <option value="box">Box</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <input style={inputStyle} value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional" />
            </div>
          </div>

          {/* Status Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#fdf8ff', borderRadius: '12px', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a0a2e' }}>Product Status</div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>{isActive ? 'Visible in POS search' : 'Hidden from POS'}</div>
            </div>
            <button onClick={() => setIsActive(!isActive)} style={{
              width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', position: 'relative',
              background: isActive ? '#9333ea' : '#e2e8f0', transition: 'background 0.2s'
            }}>
              <div style={{
                width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                position: 'absolute', top: '3px', transition: 'left 0.2s',
                left: isActive ? '22px' : '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
              }} />
            </button>
          </div>
        </div>

        {/* Footer Buttons */}
        <div style={{ padding: '0 28px 24px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '11px 24px', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            Cancel
          </button>
          {product && (
            <button onClick={() => handleSave(true)} disabled={saving} style={{ padding: '11px 20px', background: '#f5f3ff', color: '#9333ea', border: '1px solid #f3e8ff', borderRadius: '12px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              Save & Continue
            </button>
          )}
          <button onClick={() => handleSave(false)} disabled={saving || !name.trim() || !sku.trim() || !unitPrice} style={{
            padding: '11px 28px', background: '#9333ea', color: 'white', border: 'none', borderRadius: '12px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
            opacity: saving || !name.trim() || !sku.trim() || !unitPrice ? 0.5 : 1
          }}>
            {saving ? 'Saving...' : (product ? 'Update Product' : 'Save Product')}
          </button>
        </div>
      </div>
    </div>
  )
}
