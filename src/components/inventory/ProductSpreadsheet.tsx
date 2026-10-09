import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { saveProductsToCache } from '../../utils/offlineCache'
import toast from 'react-hot-toast'
import { X, Plus, Save, Trash2, Download, Upload } from 'lucide-react'
import Papa from 'papaparse'
import { SIZES, colourToCSS as colourCSS, autoGenerateBatch } from '../../utils/design'

interface ProductRow {
  id: string
  name: string
  designNo: string
  pcode: string
  size: string
  colour: string
  mrp: string
  price: string
  cost: string
  gst: string
  stock: string
  minStock: string
  batchNo: string
  category: string
  active: boolean
  error?: string
}

interface Props {
  onClose?: () => void
  onSaved?: () => void
}

function emptyRow(i: number): ProductRow {
  return {
    id: `new-${Date.now()}-${i}`,
    name: '', designNo: '', pcode: '', size: '', colour: '',
    mrp: '', price: '', cost: '', gst: '5', stock: '0',
    minStock: '5', batchNo: '', category: '', active: true
  }
}

export function ProductSpreadsheet({ onClose, onSaved }: Props) {
  const [rows, setRows] = useState<ProductRow[]>(
    Array.from({ length: 5 }, (_, i) => emptyRow(i))
  )
  const [categories, setCategories] = useState<any[]>([])
  const [editingCell, setEditingCell] = useState<{ rowId: string; column: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [scannerMode, setScannerMode] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectRef = useRef<HTMLSelectElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchCategories() }, [])

  useEffect(() => {
    if (editingCell && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 0)
    } else if (editingCell && selectRef.current) {
      setTimeout(() => selectRef.current?.focus(), 0)
    }
  }, [editingCell])

  const fetchCategories = async () => {
    try {
      const { data } = await supabase.from('categories').select('*')
      setCategories(data || [])
    } catch (e) {
      console.error('Failed to fetch categories:', e)
    }
  }

  const downloadTemplate = () => {
    const headers = [
      'name', 'design_no', 'pcode', 'size', 'colour', 'mrp',
      'selling_price', 'cost_price', 'gst_rate', 'opening_stock',
      'low_stock_alert', 'batch_no', 'hsn_code', 'category', 'brand', 'barcode'
    ]
    const sampleRows = [
      ['T-Shirt Blue 3XL', '31', '24', '3XL', 'Blue', '900', '750', '450', '5', '6', '1', '', '6205', 'T-Shirts', 'Brand Name', '8901234567890'],
      ['T-Shirt Red XL', '31', '24', 'XL', 'Red', '850', '700', '420', '5', '8', '1', '', '6205', 'T-Shirts', 'Brand Name', '8901234567891'],
      ['Pants Black 32', '8867', '12', '32', 'Black', '1500', '1200', '700', '5', '4', '1', '', '6211', 'Pants', 'Brand Name', '8901234567892'],
    ]
    const csv = headers.join(',') + '\n' + sampleRows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'products_template.csv'
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const importCSV = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        const newRows = results.data.map((row: any) => ({
          id: `new-${Date.now()}-${Math.random()}`,
          name: row.name || '',
          designNo: row.design_no || '',
          pcode: row.pcode || '',
          size: row.size || '',
          colour: row.colour || '',
          mrp: row.mrp || '',
          price: row.selling_price || '',
          cost: row.cost_price || '',
          gst: row.gst_rate || '5',
          stock: row.opening_stock || '0',
          minStock: row.low_stock_alert || '5',
          batchNo: row.batch_no || '',
          category: row.category || '',
          active: true
        }))
        setRows(newRows)
        toast.success(newRows.length + ' rows imported! Review and click Save All.')
        setScannerMode(false)
      },
      error: () => toast.error('Failed to parse CSV file')
    })
  }

  const checkBarcodeExists = async (barcode: string): Promise<boolean> => {
    try {
      const { data } = await supabase.from('products').select('id').eq('barcode', barcode).single()
      return !!data
    } catch { return false }
  }

  const columns = [
    { key: 'name',     label: 'Name',    width: 180, required: true },
    { key: 'designNo', label: 'Design',  width: 80 },
    { key: 'pcode',    label: 'PCode',   width: 70 },
    { key: 'size',     label: 'Size',    width: 90 },
    { key: 'colour',   label: 'Colour',  width: 100 },
    { key: 'mrp',      label: 'MRP',     width: 80 },
    { key: 'price',    label: 'Rate',    width: 80, required: true },
    { key: 'cost',     label: 'Cost',    width: 80 },
    { key: 'gst',      label: 'GST %',   width: 70 },
    { key: 'stock',    label: 'Stock',   width: 70 },
    { key: 'minStock', label: 'Min',     width: 60 },
    { key: 'batchNo',  label: 'Batch',   width: 110 },
    { key: 'category', label: 'Category',width: 120 },
  ]

  const addRow = () => {
    setRows([...rows, emptyRow(rows.length)])
  }

  const deleteRow = (id: string) => {
    setRows(rows.filter(r => r.id !== id))
  }

  const updateCell = (rowId: string, column: string, value: string | boolean) => {
    setRows(rows.map(r => r.id === rowId ? { ...r, [column]: value, error: undefined } : r))
  }

  const handleKeyDown = (e: React.KeyboardEvent, rowId: string, columnIndex: number) => {
    if (scannerMode && columns[columnIndex].key === 'name' && e.key === 'Enter') {
      // scanner uses barcode col but we handle name for non-barcode flow
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const nextCol = e.shiftKey ? columnIndex - 1 : columnIndex + 1
      if (nextCol >= 0 && nextCol < columns.length) {
        setEditingCell({ rowId, column: columns[nextCol].key })
      } else if (!e.shiftKey && nextCol >= columns.length) {
        const rowIndex = rows.findIndex(r => r.id === rowId)
        if (rowIndex < rows.length - 1) {
          setEditingCell({ rowId: rows[rowIndex + 1].id, column: columns[0].key })
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const rowIndex = rows.findIndex(r => r.id === rowId)
      if (rowIndex < rows.length - 1) {
        setEditingCell({ rowId: rows[rowIndex + 1].id, column: columns[columnIndex].key })
      }
    }
  }

  const validateRows = () => {
    let hasErrors = false
    const updated = rows.map(r => {
      const isEmptyRow = !r.name && !r.price && !r.cost && !r.designNo
      if (isEmptyRow) return r
      let error = ''
      if (!r.name.trim()) error = 'Name required'
      if (!r.price || Number(r.price) === 0) error = 'Price required'
      if (error) hasErrors = true
      return { ...r, error }
    })
    setRows(updated)
    return { updated, hasErrors }
  }

  const saveAll = async () => {
    const { updated, hasErrors } = validateRows()
    if (hasErrors) { toast.error('Fix errors before saving'); return }

    const rowsToSave = updated.filter(r => r.name || r.price || r.cost || r.designNo)
    if (rowsToSave.length === 0) { toast.error('No products to save'); return }

    setSaving(true)
    try {
      const products = rowsToSave.map((r, i) => ({
        id: crypto.randomUUID(),
        name: r.name.trim(),
        sku: `SKU-${Date.now().toString().slice(-6)}-${i}`,
        unit_price: Number(r.price),
        cost_price: Number(r.cost) || null,
        gst_rate: Number(r.gst) || 5,
        stock_qty: Number(r.stock) || 0,
        low_stock_alert: Number(r.minStock) || 5,
        is_active: r.active !== false,
        design_no: r.designNo.trim() || null,
        pcode: r.pcode.trim() || null,
        size: r.size.trim() || null,
        colour: r.colour.trim() || null,
        mrp: r.mrp ? Number(r.mrp) : null,
        batch_no: r.batchNo.trim() || null,
        created_at: new Date().toISOString()
      }))

      // A batch the server refuses (a barcode already in use, say) must be reported,
      // not counted as saved: those rows stay on screen to be fixed and saved again.
      let failed: typeof products = []
      let firstError = ''
      if (navigator.onLine) {
        try {
          for (let i = 0; i < products.length; i += 20) {
            const batch = products.slice(i, i + 20)
            const { error } = await supabase.from('products').insert(batch)
            if (error) { failed = [...failed, ...batch]; firstError ||= error.message }
          }
        } catch (dbErr) {
          console.warn('DB product batch save error, saving locally:', dbErr)
        }
      }

      const saved = products.filter(p => !failed.includes(p))
      saveProductsToCache(saved)
      if (failed.length) {
        toast.error(`${saved.length} saved, ${failed.length} NOT saved: ${firstError}`, { duration: 8000 })
        const failedIds = new Set(failed.map(p => p.id))
        setRows(rowsToSave.filter((_, i) => failedIds.has(products[i].id)))   // only the rows still to save
        onSaved?.()
        return
      }

      toast.success(`✅ ${products.length} products saved!`)
      setRows(Array.from({ length: 5 }, (_, i) => emptyRow(i)))
      onSaved?.()
    } catch (e: any) {
      toast.error('Failed to save products')
    } finally {
      setSaving(false)
    }
  }

  const clearAll = () => {
    if (confirm('Clear all rows?')) {
      setRows(Array.from({ length: 5 }, (_, i) => emptyRow(i)))
    }
  }

  const filledCount = rows.filter(r => r.name || r.price || r.designNo).length
  const emptyCount = rows.length - filledCount

  const btnStyle = (active = false): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '6px',
    background: active ? '#f0fdf4' : 'white',
    border: active ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
    color: active ? '#16a34a' : '#64748b',
    padding: '8px 14px', borderRadius: '8px', fontSize: '13px',
    fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif'
  })

  const cellInputStyle: React.CSSProperties = {
    border: 'none', outline: 'none', width: '100%', height: '100%',
    padding: '8px 10px', fontFamily: 'DM Sans, sans-serif',
    fontSize: '13px', background: 'transparent', color: '#1a0a2e'
  }

  const renderEditCell = (row: ProductRow, col: typeof columns[0], colIndex: number) => {
    const val = String(row[col.key as keyof ProductRow] || '')

    if (col.key === 'gst') {
      return (
        <select ref={selectRef} value={val}
          onChange={e => updateCell(row.id, col.key, e.target.value)}
          onBlur={() => setEditingCell(null)}
          onKeyDown={e => handleKeyDown(e, row.id, colIndex)}
          style={{ ...cellInputStyle, background: '#f5f3ff', cursor: 'pointer' }}>
          {['0', '5', '12', '18', '28'].map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      )
    }
    if (col.key === 'category') {
      return (
        <select ref={selectRef} value={val}
          onChange={e => updateCell(row.id, col.key, e.target.value)}
          onBlur={() => setEditingCell(null)}
          onKeyDown={e => handleKeyDown(e, row.id, colIndex)}
          style={{ ...cellInputStyle, background: '#f5f3ff', cursor: 'pointer' }}>
          <option value="">Select...</option>
          {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
        </select>
      )
    }
    if (col.key === 'size') {
      return (
        <select ref={selectRef} value={val}
          onChange={e => updateCell(row.id, col.key, e.target.value)}
          onBlur={() => setEditingCell(null)}
          onKeyDown={e => handleKeyDown(e, row.id, colIndex)}
          style={{ ...cellInputStyle, background: '#f5f3ff', cursor: 'pointer' }}>
          <option value=""></option>
          {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      )
    }
    if (col.key === 'batchNo') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%' }}>
          <input
            ref={inputRef}
            type="text"
            value={val}
            onChange={e => updateCell(row.id, col.key, e.target.value)}
            onBlur={() => setEditingCell(null)}
            onKeyDown={e => handleKeyDown(e, row.id, colIndex)}
            style={{ ...cellInputStyle, flex: 1 }}
          />
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); updateCell(row.id, col.key, autoGenerateBatch()) }}
            style={{ padding: '0 6px', background: '#f5f3ff', border: 'none', color: '#9333ea', fontSize: '10px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', height: '100%', fontFamily: 'DM Sans, sans-serif' }}
          >Auto</button>
        </div>
      )
    }
    return (
      <input
        ref={inputRef}
        type={['price', 'cost', 'mrp', 'stock', 'minStock'].includes(col.key) ? 'number' : 'text'}
        value={val}
        onChange={e => updateCell(row.id, col.key, e.target.value)}
        onBlur={() => setEditingCell(null)}
        onKeyDown={e => handleKeyDown(e, row.id, colIndex)}
        placeholder={col.key === 'price' || col.key === 'cost' || col.key === 'mrp' ? '0' : col.key === 'stock' ? '0' : col.key === 'minStock' ? '5' : ''}
        style={cellInputStyle}
      />
    )
  }

  const renderDisplayCell = (row: ProductRow, col: typeof columns[0]) => {
    const val = row[col.key as keyof ProductRow]
    if (col.key === 'price' || col.key === 'cost' || col.key === 'mrp') {
      return val ? `₹${val}` : ''
    }
    if (col.key === 'size' && val) {
      return (
        <span style={{ background: '#f5f3ff', color: '#9333ea', padding: '1px 6px', borderRadius: '99px', fontSize: '11px', fontWeight: 600 }}>
          {String(val)}
        </span>
      )
    }
    if (col.key === 'colour' && val) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colourCSS(String(val)), border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
          <span>{String(val)}</span>
        </div>
      )
    }
    return val
  }

  // for barcode scanner compatibility
  const handleScannerBarcode = async (barcode: string, rowId: string) => {
    const exists = await checkBarcodeExists(barcode)
    if (exists) {
      toast.error('⚠️ Barcode already exists in database')
      updateCell(rowId, 'name', '')
    } else {
      setEditingCell({ rowId, column: 'name' })
    }
  }

  void handleScannerBarcode // suppress unused warning

  return (
    <div style={{ background: 'white', border: '1px solid #f3e8ff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(147,51,234,0.08)', marginBottom: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid #f3e8ff', backgroundColor: '#fdf8ff' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1a0a2e' }}>Bulk Add Products</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={downloadTemplate} style={btnStyle()}>
            <Download size={14} /> Template
          </button>
          <button onClick={() => fileInputRef.current?.click()} style={btnStyle()}>
            <Upload size={14} /> Import CSV
          </button>
          <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) { importCSV(f); e.target.value = '' } }} />
          <button onClick={() => setScannerMode(!scannerMode)} style={btnStyle(scannerMode)}>
            📡 {scannerMode ? 'Scanner ON' : 'Scanner OFF'}
          </button>
          <button onClick={addRow} style={{ ...btnStyle(), border: '1px solid #c084fc', color: '#9333ea' }}>
            <Plus size={16} /> Add Row
          </button>
          <button onClick={saveAll} disabled={saving} style={{ ...btnStyle(), background: '#9333ea', color: 'white', border: 'none', opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
            <Save size={16} /> {saving ? 'Saving...' : 'Save All'}
          </button>
          <button onClick={clearAll} style={{ ...btnStyle(), border: '1px solid #fecaca', color: '#ef4444' }}>
            <Trash2 size={16} /> Clear
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
            <X size={20} />
          </button>
        </div>
      </div>

      {scannerMode && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '8px 16px', fontSize: '12px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 16px 0', fontWeight: 500 }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a', animation: 'pulse 1s infinite' }} />
          Scanner Mode Active — Scan barcode to add product
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '600px' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: 'DM Sans, sans-serif', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f5f3ff', position: 'sticky', top: 0 }}>
              <th style={thStyle}>#</th>
              {columns.map(col => (
                <th key={col.key} style={{ ...thStyle, width: `${col.width}px` }}>
                  {col.label}{col.required && <span style={{ color: '#ef4444' }}>*</span>}
                </th>
              ))}
              <th style={{ ...thStyle, width: '30px' }}>✕</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.id}
                style={{ background: row.error ? '#fef2f2' : rowIndex % 2 === 0 ? 'white' : '#fafafa', height: '44px' }}
                onMouseEnter={e => (e.currentTarget.style.background = row.error ? '#fef2f2' : '#fdf8ff')}
                onMouseLeave={e => (e.currentTarget.style.background = row.error ? '#fef2f2' : rowIndex % 2 === 0 ? 'white' : '#fafafa')}
              >
                <td style={{ width: '30px', padding: '8px', textAlign: 'center', border: '1px solid #f3e8ff', background: '#f5f3ff', color: '#9333ea', fontSize: '11px', fontWeight: 500 }}>
                  {rowIndex + 1}
                </td>
                {columns.map((col, colIndex) => (
                  <td key={`${row.id}-${col.key}`}
                    style={{ width: `${col.width}px`, padding: 0, border: '1px solid #f3e8ff', cursor: 'cell' }}
                    onClick={() => setEditingCell({ rowId: row.id, column: col.key })}>
                    {editingCell?.rowId === row.id && editingCell?.column === col.key
                      ? renderEditCell(row, col, colIndex)
                      : (
                        <div style={{ padding: '8px 10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#1a0a2e', minHeight: '44px', display: 'flex', alignItems: 'center' }}>
                          {renderDisplayCell(row, col)}
                        </div>
                      )
                    }
                  </td>
                ))}
                <td style={{ width: '30px', padding: '8px', textAlign: 'center', border: '1px solid #f3e8ff' }}>
                  <button onClick={() => deleteRow(row.id)}
                    style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '16px', padding: '2px' }}
                    onMouseEnter={e => ((e.target as HTMLElement).style.color = '#ef4444')}
                    onMouseLeave={e => ((e.target as HTMLElement).style.color = '#cbd5e1')}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid #f3e8ff', background: '#fdf8ff', fontSize: '12px', color: '#64748b' }}>
        <span>{rows.length} rows · {filledCount} filled · {emptyCount} empty</span>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: filledCount > 0 && !rows.some(r => r.error) ? '#16a34a' : '#f59e0b' }} />
      </div>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  width: '30px', padding: '8px 10px', textAlign: 'left',
  fontSize: '11px', fontWeight: 600, color: '#9333ea',
  border: '1px solid #f3e8ff', backgroundColor: '#f5f3ff',
  textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap'
}
