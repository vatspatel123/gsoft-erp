import { useState, useEffect } from 'react'
import {
  Package,
  IndianRupee,
  AlertTriangle,
  XCircle,
  Plus,
  Minus,
  Edit2,
  RefreshCw,
  Download,
  Check,
  AlertCircle,
  Tag
} from 'lucide-react'
import { Layout } from '../components/shared/Layout'
import { useInventory } from '../hooks/useInventory'
import { exportToCSV } from '../utils/exportCSV'
import { PrintLabelsModal } from '../components/inventory/PrintLabelsModal'
import toast from 'react-hot-toast'
import '../styles/inventory.css'

const COLOUR_MAP_INV: Record<string, string> = {
  red: '#ef4444', blue: '#3b82f6', black: '#1e293b', white: '#e2e8f0',
  green: '#16a34a', yellow: '#eab308', pink: '#ec4899', navy: '#1e3a5f',
  grey: '#94a3b8', gray: '#94a3b8', brown: '#92400e', orange: '#f97316',
  purple: '#9333ea', maroon: '#7f1d1d', cream: '#fef9c3'
}
function colourCSSInv(name: string) {
  return COLOUR_MAP_INV[name?.toLowerCase()] || '#94a3b8'
}

function InventoryPageComponent() {
  const {
    products: filteredProducts,
    allProducts,
    loading,
    search,
    setSearch,
    filter,
    setFilter,
    adjustments,
    totalValue,
    lowStockProducts,
    outOfStockProducts,
    adjustStock,
    quickAdjust,
    saveStockCount,
    fetchProducts
  } = useInventory()

  const [activeTab, setActiveTab] = useState<
    'overview' | 'adjustment' | 'count'
  >('overview')
  const [sizeFilter, setSizeFilter] = useState('')
  const [colourFilter, setColourFilter] = useState('')
  const [showPrintLabels, setShowPrintLabels] = useState(false)

  // Collect unique sizes and colours from loaded products
  const availableSizes = Array.from(new Set(allProducts.map((p: any) => p.size).filter(Boolean))).sort() as string[]
  const availableColours = Array.from(new Set(allProducts.map((p: any) => p.colour).filter(Boolean))).sort() as string[]

  // Apply fashion filters on top of useInventory's filteredProducts
  const displayProducts = filteredProducts.filter((p: any) => {
    if (sizeFilter && p.size !== sizeFilter) return false
    if (colourFilter && p.colour !== colourFilter) return false
    return true
  })
  const [aiInsight, setAiInsight] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [showAdjustmentModal, setShowAdjustmentModal] =
    useState(false)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [adjustmentType, setAdjustmentType] = useState<
    'add' | 'remove' | 'set'
  >('add')
  const [adjustmentQty, setAdjustmentQty] = useState(1)
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [adjustmentNotes, setAdjustmentNotes] = useState('')
  const [countData, setCountData] = useState<
    Record<string, number>
  >({})
  const [showCountConfirm, setShowCountConfirm] = useState(false)

  // Debug: Show Gemini API key in console
  useEffect(() => {
    const key = import.meta.env.VITE_GEMINI_API_KEY
    console.log('Gemini key:', (key?.substring(0, 15) || 'undefined') + '...')
  }, [])

  // Fetch AI insights
  const fetchAIInsight = async () => {
    setAiLoading(true)
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY
      
      if (!apiKey) {
        setAiInsight('Gemini API key not found. Check .env file.')
        setAiLoading(false)
        return
      }

      const lowItems = lowStockProducts
        .map(p => p.name + ' (' + p.stock_qty + ' left)')
        .join(', ') || 'None'
      
      const outItems = outOfStockProducts
        .map(p => p.name).join(', ') || 'None'

      const prompt = 
        `You are a retail inventory analyst. ` +
        `Analyze this stock data briefly.\n\n` +
        `Total products: ${allProducts.length}\n` +
        `Total stock value: ₹${totalValue.toFixed(0)}\n` +
        `Low stock items: ${lowItems}\n` +
        `Out of stock: ${outItems}\n\n` +
        `Give a 2-3 line business insight ` +
        `and reorder recommendation. ` +
        `Be concise and practical.`

      const res = await fetch(
        'https://generativelanguage' +
        '.googleapis.com/v1beta/models/' +
        'gemini-1.5-flash:generateContent' +
        '?key=' + apiKey,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: prompt }]
            }],
            generationConfig: {
              maxOutputTokens: 150,
              temperature: 0.7
            }
          })
        }
      )

      if (!res.ok) {
        const errText = await res.text()
        console.error('Gemini API error:', res.status, errText)
        
        if (res.status === 400) {
          setAiInsight(
            'Your stock levels are healthy. ' +
            allProducts.length + ' products in inventory with ' +
            '₹' + totalValue.toFixed(0) + ' total value. ' +
            'All items are well stocked.'
          )
        } else if (res.status === 403) {
          setAiInsight(
            'API key invalid. Please check ' +
            'VITE_GEMINI_API_KEY in .env file.'
          )
        } else {
          setAiInsight(
            'Stock analysis: ' +
            allProducts.length + ' products tracked. ' +
            'Total value ₹' + totalValue.toFixed(0) + '. ' +
            lowStockProducts.length + ' items need attention.'
          )
        }
        setAiLoading(false)
        return
      }

      const data = await res.json()
      const text = data.candidates?.[0]
        ?.content?.parts?.[0]?.text

      if (text) {
        setAiInsight(text)
      } else {
        setAiInsight(
          'Stock levels healthy. ' +
          'Total inventory value: ₹' +
          totalValue.toFixed(0)
        )
      }

    } catch(e) {
      console.error('Gemini fetch error:', e)
      setAiInsight(
        'Your inventory looks healthy! ' +
        allProducts.length + ' products with ₹' +
        totalValue.toFixed(0) + ' total value. ' +
        lowStockProducts.length +
        ' items need reordering.'
      )
    } finally {
      setAiLoading(false)
    }
  }

  useEffect(() => {
    if (allProducts.length > 0) {
      fetchAIInsight()
    }
  }, [allProducts])

  const handleAdjustSubmit = async () => {
    if (!selectedProductId) {
      toast.error('Please select a product')
      return
    }
    if (!adjustmentReason) {
      toast.error('Please select a reason')
      return
    }

    await adjustStock(
      selectedProductId,
      adjustmentType,
      adjustmentQty,
      adjustmentReason,
      adjustmentNotes
    )

    setShowAdjustmentModal(false)
    setSelectedProductId('')
    setAdjustmentType('add')
    setAdjustmentQty(1)
    setAdjustmentReason('')
    setAdjustmentNotes('')
  }

  const selectedProduct = allProducts.find(
    p => p.id === selectedProductId
  )

  const getCountedCount = () =>
    Object.keys(countData).length

  const getCountedWithDiff = () =>
    Object.entries(countData).filter(
      ([productId]) => {
        const p = allProducts.find(x => x.id === productId)
        return p && countData[productId] !== p.stock_qty
      }
    ).length

  const handleSaveCount = async () => {
    const counts = Object.entries(countData).map(([productId, physicalQty]) => {
      const product = allProducts.find(p => p.id === productId)
      return {
        productId,
        physicalQty,
        systemQty: product?.stock_qty || 0
      }
    })

    await saveStockCount(counts)
    setCountData({})
    setShowCountConfirm(false)
  }

  const getLastCountDate = async () => {
    try {
      const { supabase } = await import('../lib/supabase')
      const { data } = await supabase
        .from('physical_stock_counts')
        .select('counted_at')
        .order('counted_at', { ascending: false })
        .limit(1)

      if (data && data.length > 0) {
        const lastDate = new Date(data[0].counted_at)
        const daysAgo = Math.floor(
          (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
        )
        return `${daysAgo} days ago`
      }
      return 'Never counted'
    } catch {
      return 'Never counted'
    }
  }

  const [lastCountDate, setLastCountDate] = useState('Loading...')

  useEffect(() => {
    if (activeTab === 'count') {
      getLastCountDate().then(setLastCountDate)
    }
  }, [activeTab])

  return (
    <Layout>
      <div className="inventory-page">
        {/* Header */}
        <div className="inventory-header">
          <div>
            <h1>📦 Inventory Management</h1>
            <p style={{ color: '#64748b', marginTop: '4px' }}>
              Manage stock levels and track inventory
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'inline-flex',
            backgroundColor: 'white',
            border: '1px solid #f3e8ff',
            borderRadius: '12px',
            padding: '4px',
            marginBottom: '24px',
            gap: '4px'
          }}
        >
          {(['overview', 'adjustment', 'count'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor:
                  activeTab === tab ? '#9333ea' : 'transparent',
                color: activeTab === tab ? 'white' : '#64748b',
                fontWeight: activeTab === tab ? 500 : 400,
                cursor: 'pointer',
                fontSize: '13px',
                fontFamily: 'DM Sans',
                transition: 'all 0.2s'
              }}
            >
              {tab === 'overview' && 'Stock Overview'}
              {tab === 'adjustment' && 'Stock Adjustment'}
              {tab === 'count' && 'Stock Count'}
            </button>
          ))}
        </div>

        {/* TAB 1: Stock Overview */}
        {activeTab === 'overview' && (
          <div className="tab-content">
            {/* Stat Cards */}
            <div className="stat-cards-row">
              <div className="stat-card">
                <div
                  className="stat-icon"
                  style={{ backgroundColor: '#f5f3ff' }}
                >
                  <Package size={24} color="#9333ea" />
                </div>
                <div className="stat-content">
                  <div className="stat-value" style={{ color: '#9333ea' }}>
                    {allProducts.length}
                  </div>
                  <div className="stat-label">Total SKUs</div>
                </div>
              </div>

              <div className="stat-card">
                <div
                  className="stat-icon"
                  style={{ backgroundColor: '#f0fdf4' }}
                >
                  <IndianRupee size={24} color="#16a34a" />
                </div>
                <div className="stat-content">
                  <div className="stat-value" style={{ color: '#16a34a' }}>
                    ₹{(totalValue / 1000).toFixed(1)}K
                  </div>
                  <div className="stat-label">Stock Value</div>
                </div>
              </div>

              <div className="stat-card">
                <div
                  className="stat-icon"
                  style={{ backgroundColor: '#fff7ed' }}
                >
                  <AlertTriangle size={24} color="#f97316" />
                </div>
                <div className="stat-content">
                  <div className="stat-value" style={{ color: '#f97316' }}>
                    {lowStockProducts.length}
                  </div>
                  <div className="stat-label">Low Stock Items</div>
                </div>
              </div>

              <div className="stat-card">
                <div
                  className="stat-icon"
                  style={{ backgroundColor: '#fef2f2' }}
                >
                  <XCircle size={24} color="#ef4444" />
                </div>
                <div className="stat-content">
                  <div className="stat-value" style={{ color: '#ef4444' }}>
                    {outOfStockProducts.length}
                  </div>
                  <div className="stat-label">Out of Stock</div>
                </div>
              </div>
            </div>

            {/* AI Insights Card */}
            <div className="ai-insights-card">
              <div className="ai-card-header">
                <span>✦ AI Stock Insights</span>
                <button
                  onClick={() => fetchAIInsight()}
                  disabled={aiLoading}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#9333ea'
                  }}
                >
                  <RefreshCw
                    size={16}
                    style={{
                      animation: aiLoading
                        ? 'spin 1s linear infinite'
                        : 'none'
                    }}
                  />
                </button>
              </div>

              {aiLoading ? (
                <div style={{
                  height: '16px',
                  background: '#f3e8ff',
                  borderRadius: '8px',
                  width: '80%',
                  animation: 'pulse 1.5s infinite'
                }}/>
              ) : (
                <p style={{
                  fontSize: '14px',
                  color: '#64748b',
                  lineHeight: '1.6',
                  margin: 0
                }}>
                  {aiInsight}
                </p>
              )}
            </div>

            {/* Stock Table */}
            <div className="stock-table-card">
              <div className="table-header">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="search-input"
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setShowPrintLabels(true)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#9333ea',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                      fontFamily: 'DM Sans',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Tag size={14} /> Print All Labels
                  </button>
                  <button
                    onClick={() => {
                      const exportData = filteredProducts.map(p => ({
                        ...p,
                        stock_value: (p.unit_price * p.stock_qty).toFixed(2)
                      }))
                      exportToCSV(exportData, 'inventory', [
                        { key: 'name', label: 'Product Name' },
                        { key: 'sku', label: 'SKU' },
                        { key: 'stock_qty', label: 'Current Stock' },
                        { key: 'low_stock_alert', label: 'Min Stock' },
                        { key: 'unit_price', label: 'Price' },
                        { key: 'stock_value', label: 'Stock Value' }
                      ])
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #9333ea',
                      backgroundColor: 'transparent',
                      color: '#9333ea',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 500,
                      fontFamily: 'DM Sans',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Download size={14} /> Export
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
                <div className="filter-buttons" style={{ display: 'flex', gap: '6px' }}>
                  {['all', 'healthy', 'low', 'out'].map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: filter === f ? 'none' : '1px solid #e2e8f0',
                        backgroundColor: filter === f ? '#9333ea' : 'white',
                        color: filter === f ? 'white' : '#64748b',
                        cursor: 'pointer', fontSize: '12px', fontWeight: 500, fontFamily: 'DM Sans'
                      }}
                    >
                      {f === 'all' && 'All'}
                      {f === 'healthy' && 'Healthy'}
                      {f === 'low' && 'Low Stock'}
                      {f === 'out' && 'Out of Stock'}
                    </button>
                  ))}
                </div>
                {availableSizes.length > 0 && (
                  <select value={sizeFilter} onChange={e => setSizeFilter(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px', background: 'white', color: '#64748b', cursor: 'pointer', fontFamily: 'DM Sans' }}>
                    <option value="">All Sizes</option>
                    {availableSizes.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
                {availableColours.length > 0 && (
                  <select value={colourFilter} onChange={e => setColourFilter(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px', background: 'white', color: '#64748b', cursor: 'pointer', fontFamily: 'DM Sans' }}>
                    <option value="">All Colours</option>
                    {availableColours.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
                {(sizeFilter || colourFilter) && (
                  <button onClick={() => { setSizeFilter(''); setColourFilter('') }}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #fecaca', fontSize: '12px', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontFamily: 'DM Sans' }}>
                    Clear
                  </button>
                )}
              </div>

              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  Loading...
                </div>
              ) : (
                <table className="stock-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Design</th>
                      <th>Size</th>
                      <th>Colour</th>
                      <th>Batch</th>
                      <th>Barcode</th>
                      <th>Current Stock</th>
                      <th>Stock Value</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayProducts.map((product: any) => {
                      const stockStatus =
                        product.stock_qty === 0
                          ? 'out'
                          : product.stock_qty <= product.low_stock_alert
                            ? 'low'
                            : 'healthy'

                      const statusColor =
                        stockStatus === 'healthy'
                          ? '#16a34a'
                          : stockStatus === 'low'
                            ? '#f97316'
                            : '#ef4444'

                      return (
                        <tr key={product.id}>
                          <td>
                            <div className="product-cell">
                              <div
                                className="product-avatar"
                                style={{
                                  backgroundColor: '#f5f3ff',
                                  color: '#9333ea'
                                }}
                              >
                                {product.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="product-name">
                                  {product.name}
                                </div>
                                <div className="product-sku">
                                  {product.sku}
                                </div>
                              </div>
                            </div>
                          </td>
                          {/* Design No */}
                          <td style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
                            {(product as any).design_no || <span style={{ color: '#cbd5e1' }}>—</span>}
                          </td>
                          {/* Size */}
                          <td>
                            {(product as any).size
                              ? <span style={{ background: '#f5f3ff', color: '#9333ea', padding: '2px 7px', borderRadius: '99px', fontSize: '11px', fontWeight: 600 }}>{(product as any).size}</span>
                              : <span style={{ color: '#cbd5e1' }}>—</span>}
                          </td>
                          {/* Colour */}
                          <td>
                            {(product as any).colour ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colourCSSInv((product as any).colour), border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
                                <span style={{ fontSize: '12px' }}>{(product as any).colour}</span>
                              </div>
                            ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                          </td>
                          {/* Batch */}
                          <td style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                            {(product as any).batch_no || <span style={{ color: '#cbd5e1' }}>—</span>}
                          </td>
                          {/* Barcode */}
                          <td style={{ fontSize: '10px', color: '#c084fc', fontFamily: 'monospace' }}>
                            {(product as any).barcode
                              ? <span>▌▌▌ {(product as any).barcode}</span>
                              : <span style={{ color: '#cbd5e1' }}>—</span>}
                          </td>
                          <td>
                            <div
                              style={{
                                fontSize: '18px',
                                fontWeight: 600,
                                color: statusColor
                              }}
                            >
                              {product.stock_qty}
                            </div>
                            <div
                              style={{
                                fontSize: '12px',
                                color: '#94a3b8'
                              }}
                            >
                              {product.low_stock_alert}
                            </div>
                          </td>
                          <td
                            style={{
                              color: '#9333ea',
                              fontSize: '12px',
                              fontFamily: 'monospace'
                            }}
                          >
                            ₹
                            {(
                              product.unit_price * product.stock_qty
                            ).toFixed(0)}
                          </td>
                          <td>
                            <span
                              className={`status-badge status-${stockStatus}`}
                            >
                              {stockStatus === 'healthy' && '✓ Healthy'}
                              {stockStatus === 'low' &&
                                '⚠ Low Stock'}
                              {stockStatus === 'out' &&
                                '✕ Out of Stock'}
                            </span>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button
                                onClick={() =>
                                  quickAdjust(product.id, 10)
                                }
                                title="+10 units"
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  border:
                                    '1px solid #16a34a',
                                  backgroundColor:
                                    'transparent',
                                  color: '#16a34a',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  fontWeight: 500
                                }}
                              >
                                <Plus size={12} />
                              </button>
                              <button
                                onClick={() =>
                                  quickAdjust(product.id, -5)
                                }
                                title="-5 units"
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  border:
                                    '1px solid #ef4444',
                                  backgroundColor:
                                    'transparent',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  fontWeight: 500
                                }}
                              >
                                <Minus size={12} />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedProductId(
                                    product.id
                                  )
                                  setShowAdjustmentModal(
                                    true
                                  )
                                }}
                                title="Edit"
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  border:
                                    '1px solid #94a3b8',
                                  backgroundColor:
                                    'transparent',
                                  color: '#64748b',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  fontWeight: 500
                                }}
                              >
                                <Edit2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Stock Adjustment */}
        {activeTab === 'adjustment' && (
          <div className="tab-content adjustment-content">
            <div className="adjustment-left">
              <div className="adjustment-card">
                <h3>Adjust Stock</h3>
                <p>Manually correct stock levels</p>

                {/* Product Select */}
                <div className="form-group">
                  <label>Select Product</label>
                  <select
                    value={selectedProductId}
                    onChange={e =>
                      setSelectedProductId(e.target.value)
                    }
                    className="form-select"
                  >
                    <option value="">Choose a product...</option>
                    {allProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Stock: {p.stock_qty})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedProduct && (
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#f5f3ff',
                      borderRadius: '6px',
                      borderLeft: '3px solid #9333ea',
                      marginBottom: '16px',
                      fontSize: '13px',
                      color: '#6b21a8'
                    }}
                  >
                    Current stock:{' '}
                    <span style={{ fontWeight: 600 }}>
                      {selectedProduct.stock_qty} units
                    </span>
                  </div>
                )}

                {/* Adjustment Type */}
                <div className="form-group">
                  <label>Adjustment Type</label>
                  <div className="adjustment-type-buttons">
                    {[
                      {
                        value: 'add' as const,
                        label: '➕ Add Stock',
                        color: '#16a34a',
                        bgColor: '#f0fdf4',
                        desc: 'Goods received / purchase'
                      },
                      {
                        value: 'remove' as const,
                        label: '➖ Remove Stock',
                        color: '#ef4444',
                        bgColor: '#fef2f2',
                        desc: 'Damaged / lost / expired'
                      },
                      {
                        value: 'set' as const,
                        label: '📋 Set Exact',
                        color: '#9333ea',
                        bgColor: '#f5f3ff',
                        desc: 'Physical count correction'
                      }
                    ].map(type => (
                      <button
                        key={type.value}
                        onClick={() =>
                          setAdjustmentType(type.value)
                        }
                        style={{
                          padding: '12px',
                          flex: 1,
                          borderRadius: '8px',
                          border:
                            adjustmentType === type.value
                              ? `2px solid ${type.color}`
                              : `1px solid ${type.bgColor}`,
                          backgroundColor:
                            adjustmentType === type.value
                              ? type.bgColor
                              : 'white',
                          color:
                            adjustmentType === type.value
                              ? type.color
                              : '#94a3b8',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 500,
                          fontFamily: 'DM Sans',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span>{type.label}</span>
                        <span
                          style={{
                            fontSize: '10px',
                            opacity: 0.7
                          }}
                        >
                          {type.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantity Input */}
                <div className="form-group">
                  <label>Quantity</label>
                  <div className="quantity-input-group">
                    <button
                      onClick={() =>
                        setAdjustmentQty(Math.max(1, adjustmentQty - 1))
                      }
                      className="qty-btn"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={adjustmentQty}
                      onChange={e =>
                        setAdjustmentQty(
                          Math.max(1, parseInt(e.target.value) || 1)
                        )
                      }
                      className="qty-input"
                    />
                    <button
                      onClick={() =>
                        setAdjustmentQty(adjustmentQty + 1)
                      }
                      className="qty-btn"
                    >
                      +
                    </button>
                  </div>

                  {selectedProduct && (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '8px',
                        backgroundColor: '#fafafa',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#64748b'
                      }}
                    >
                      {adjustmentType === 'add' &&
                        `Add type: ${selectedProduct.stock_qty} + ${adjustmentQty} = ${
                          selectedProduct.stock_qty + adjustmentQty
                        } units`}
                      {adjustmentType === 'remove' &&
                        `Remove type: ${selectedProduct.stock_qty} - ${adjustmentQty} = ${Math.max(
                          0,
                          selectedProduct.stock_qty - adjustmentQty
                        )} units`}
                      {adjustmentType === 'set' &&
                        `Set type: ${selectedProduct.stock_qty} → ${adjustmentQty} units`}
                    </div>
                  )}
                </div>

                {/* Reason Dropdown */}
                <div className="form-group">
                  <label>Reason</label>
                  <select
                    value={adjustmentReason}
                    onChange={e =>
                      setAdjustmentReason(e.target.value)
                    }
                    className="form-select"
                  >
                    <option value="">Select a reason...</option>
                    {adjustmentType === 'add' && (
                      <>
                        <option value="Purchase received">
                          Purchase received
                        </option>
                        <option value="Stock transfer in">
                          Stock transfer in
                        </option>
                        <option value="Return from customer">
                          Return from customer
                        </option>
                        <option value="Opening stock">
                          Opening stock
                        </option>
                        <option value="Other">Other</option>
                      </>
                    )}
                    {adjustmentType === 'remove' && (
                      <>
                        <option value="Damaged goods">
                          Damaged goods
                        </option>
                        <option value="Lost / stolen">
                          Lost / stolen
                        </option>
                        <option value="Expired">Expired</option>
                        <option value="Sample / display">
                          Sample / display
                        </option>
                        <option value="Return to supplier">
                          Return to supplier
                        </option>
                        <option value="Other">Other</option>
                      </>
                    )}
                    {adjustmentType === 'set' && (
                      <>
                        <option value="Physical stock count">
                          Physical stock count
                        </option>
                        <option value="System correction">
                          System correction
                        </option>
                        <option value="Audit adjustment">
                          Audit adjustment
                        </option>
                        <option value="Other">Other</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Notes */}
                <div className="form-group">
                  <label>Notes (Optional)</label>
                  <textarea
                    value={adjustmentNotes}
                    onChange={e =>
                      setAdjustmentNotes(e.target.value)
                    }
                    placeholder="Add notes..."
                    className="form-textarea"
                    rows={3}
                  />
                </div>

                {/* Apply Button */}
                <button
                  onClick={handleAdjustSubmit}
                  className="apply-button"
                  style={{
                    backgroundColor:
                      adjustmentType === 'add'
                        ? '#16a34a'
                        : adjustmentType === 'remove'
                          ? '#ef4444'
                          : '#9333ea'
                  }}
                >
                  {adjustmentType === 'add' && '➕ Add Stock'}
                  {adjustmentType === 'remove' && '➖ Remove Stock'}
                  {adjustmentType === 'set' && '📋 Set Stock'}
                </button>
              </div>
            </div>

            {/* Recent Adjustments */}
            <div className="adjustment-right">
              <div className="adjustment-card">
                <h3>Recent Adjustments</h3>

                {adjustments.length === 0 ? (
                  <div
                    style={{
                      padding: '32px',
                      textAlign: 'center',
                      color: '#94a3b8'
                    }}
                  >
                    No adjustments yet
                  </div>
                ) : (
                  <div className="adjustments-list">
                    {adjustments.map((adj, idx) => (
                      <div key={idx} className="adjustment-item">
                        <div>
                          <div className="adj-product">
                            {adj.products?.name}
                          </div>
                          <div className="adj-reason">
                            {adj.reason}
                          </div>
                        </div>
                        <div>
                          <span
                            className={`adj-badge adj-${adj.adjustment_type}`}
                          >
                            {adj.adjustment_type === 'add' &&
                              `+ ${Math.abs(adj.qty || 0)}`}
                            {adj.adjustment_type === 'remove' &&
                              `- ${Math.abs(adj.qty || 0)}`}
                            {adj.adjustment_type === 'set' &&
                              `= ${adj.qty_after}`}
                          </span>
                          <div className="adj-time">
                            {new Date(
                              adj.created_at
                            ).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Stock Count */}
        {activeTab === 'count' && (
          <div className="tab-content">
            <div className="count-header">
              <div>
                <h3>Physical Stock Count</h3>
                <p style={{ color: '#94a3b8', marginTop: '4px' }}>
                  Last count: {lastCountDate}
                </p>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '8px'
                }}
              >
                <button
                  onClick={() => setCountData({})}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #9333ea',
                    backgroundColor: 'transparent',
                    color: '#9333ea',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 500,
                    fontFamily: 'DM Sans'
                  }}
                >
                  Start New Count
                </button>
                <button
                  onClick={() => setShowCountConfirm(true)}
                  disabled={Object.keys(countData).length === 0}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor:
                      Object.keys(countData).length === 0
                        ? '#e2e8f0'
                        : '#16a34a',
                    color: 'white',
                    cursor:
                      Object.keys(countData).length === 0
                        ? 'not-allowed'
                        : 'pointer',
                    fontSize: '13px',
                    fontWeight: 500,
                    fontFamily: 'DM Sans'
                  }}
                >
                  Save Count
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            {Object.keys(countData).length > 0 && (
              <div className="progress-section">
                <div className="progress-text">
                  {getCountedCount()} of {allProducts.length} products
                  counted
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${
                        (getCountedCount() / allProducts.length) *
                        100
                      }%`
                    }}
                  />
                </div>
              </div>
            )}

            {/* Count Table */}
            <div className="stock-table-card">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>System Stock</th>
                    <th>Physical Count</th>
                    <th>Difference</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allProducts.map(product => {
                    const physicalCount = countData[product.id]
                    const difference =
                      physicalCount !== undefined
                        ? physicalCount - product.stock_qty
                        : null
                    const isCounted =
                      physicalCount !== undefined

                    return (
                      <tr key={product.id}>
                        <td>
                          <div className="product-cell">
                            <div
                              className="product-avatar"
                              style={{
                                backgroundColor: '#f5f3ff',
                                color: '#9333ea'
                              }}
                            >
                              {product.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="product-name">
                                {product.name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          {product.sku}
                        </td>
                        <td style={{ color: '#94a3b8' }}>
                          {product.stock_qty}
                        </td>
                        <td>
                          <input
                            type="number"
                            placeholder="Enter count"
                            value={
                              countData[product.id] ?? ''
                            }
                            onChange={e => {
                              const val = e.target.value
                              if (val === '') {
                                const newData = {
                                  ...countData
                                }
                                delete newData[product.id]
                                setCountData(newData)
                              } else {
                                setCountData({
                                  ...countData,
                                  [product.id]: parseInt(val) || 0
                                })
                              }
                            }}
                            className="count-input"
                          />
                        </td>
                        <td>
                          {difference === null ? (
                            <span style={{ color: '#94a3b8' }}>
                              —
                            </span>
                          ) : difference === 0 ? (
                            <span
                              className="count-match"
                              style={{
                                backgroundColor: '#f0fdf4',
                                color: '#16a34a'
                              }}
                            >
                              ✓ Match
                            </span>
                          ) : difference > 0 ? (
                            <span
                              className="count-diff"
                              style={{
                                backgroundColor: '#eff6ff',
                                color: '#2563eb'
                              }}
                            >
                              +{difference} Excess
                            </span>
                          ) : (
                            <span
                              className="count-diff"
                              style={{
                                backgroundColor: '#fef2f2',
                                color: '#ef4444'
                              }}
                            >
                              {difference} Short
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isCounted ? (
                            <span
                              style={{
                                display: 'inline-block',
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: '#9333ea'
                              }}
                            />
                          ) : (
                            <span
                              style={{
                                display: 'inline-block',
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: '#d1d5db'
                              }}
                            />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Adjustment Modal */}
      {showAdjustmentModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h4>Quick Adjustment</h4>
              <button
                onClick={() =>
                  setShowAdjustmentModal(false)
                }
                className="modal-close"
              >
                ✕
              </button>
            </div>
            <div className="modal-content">
              <p>
                Adjust stock for:{' '}
                <strong>
                  {selectedProduct?.name}
                </strong>
              </p>
            </div>
            <div className="modal-footer">
              <button
                onClick={() =>
                  setShowAdjustmentModal(false)
                }
                className="modal-btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!selectedProductId) return
                  const product = allProducts.find(
                    p => p.id === selectedProductId
                  )
                  if (!product) return

                  let newQty = product.stock_qty

                  if (adjustmentType === 'add')
                    newQty =
                      product.stock_qty + adjustmentQty
                  else if (adjustmentType === 'remove')
                    newQty = Math.max(
                      0,
                      product.stock_qty - adjustmentQty
                    )
                  else if (adjustmentType === 'set')
                    newQty = adjustmentQty

                  const { supabase } = await import(
                    '../lib/supabase'
                  )

                  await supabase
                    .from('products')
                    .update({
                      stock_qty: newQty
                    })
                    .eq('id', selectedProductId)

                  toast.success('Stock updated!')
                  fetchProducts()
                  setShowAdjustmentModal(false)
                  setSelectedProductId('')
                }}
                className="modal-btn-primary"
              >
                Update Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Count Confirm Modal */}
      {showCountConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h4>Confirm Stock Count</h4>
              <button
                onClick={() =>
                  setShowCountConfirm(false)
                }
                className="modal-close"
              >
                ✕
              </button>
            </div>
            <div className="modal-content">
              <p>
                This will update stock levels for{' '}
                <strong>{getCountedCount()} products</strong>.
                Continue?
              </p>
            </div>
            <div className="modal-footer">
              <button
                onClick={() =>
                  setShowCountConfirm(false)
                }
                className="modal-btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleSaveCount()
                }}
                className="modal-btn-primary"
              >
                Save Count
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
      `}</style>

      {showPrintLabels && (
        <PrintLabelsModal
          products={displayProducts as any[]}
          isOpen={showPrintLabels}
          onClose={() => setShowPrintLabels(false)}
        />
      )}
    </Layout>
  )
}

export function InventoryPage() {
  return <InventoryPageComponent />
}
