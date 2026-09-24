import { useState } from 'react'
import { X, Printer } from 'lucide-react'
import { printBarcodeLabels } from '../../utils/printLabels'
import toast from 'react-hot-toast'
import { getSettings } from '../../utils/settings'

interface Props {
  products: any[]
  isOpen: boolean
  onClose: () => void
}

type Format = '38x38' | '50x25' | '50x30' | '58mm'

const FORMAT_OPTIONS: { value: Format; label: string; desc: string }[] = [
  { value: '58mm', label: '58mm Thermal', desc: '58mm Bluetooth/USB thermal printer (1 label per row)' },
  { value: '38x38', label: '38×38mm Double', desc: 'Standard fashion label (2 per row)' },
  { value: '50x25', label: '50×25mm', desc: 'Small barcode label' },
  { value: '50x30', label: '50×30mm', desc: 'Medium label' },
]

export function PrintLabelsModal({ products, isOpen, onClose }: Props) {
  const [format, setFormat] = useState<Format>('58mm')
  const [globalCopies, setGlobalCopies] = useState(1)
  const [rows, setRows] = useState(() =>
    products.map(p => ({
      id: p.id,
      included: true,
      barcode: p.barcode || p.batch_no || p.sku || '',
      copies: 1,
      product: p,
    }))
  )

  const settings = getSettings()
  const shopName = settings.shopName || 'Retail ERP'
  const selectedProduct = products[0]

  const includedRows = rows.filter(r => r.included)
  const totalLabels = includedRows.reduce((sum, r) => sum + r.copies * globalCopies, 0)

  const toggleRow = (id: string) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, included: !r.included } : r))

  const updateBarcode = (id: string, val: string) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, barcode: val } : r))

  const updateCopies = (id: string, val: number) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, copies: Math.max(1, val) } : r))

  // One sheet of stickers is a normal print; hundreds is someone having held an
  // arrow down. Ask rather than commit a roll of labels to it.
  const MAX_LABELS = 200

  const handlePrint = () => {
    const toPrint: any[] = []
    includedRows.forEach(row => {
      const prod = { ...row.product, barcode: row.barcode }
      for (let i = 0; i < row.copies * globalCopies; i++) {
        toPrint.push(prod)
      }
    })
    if (toPrint.length === 0) return
    if (toPrint.length > MAX_LABELS) {
      toast.error(`That is ${toPrint.length} labels. Reduce the copies to ${MAX_LABELS} or fewer.`)
      return
    }
    printBarcodeLabels(toPrint, 1, format)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.45)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px'
    }}>
      <div style={{
        background: 'white', borderRadius: '20px', width: '100%', maxWidth: '560px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', fontFamily: 'DM Sans, sans-serif'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid #f3e8ff' }}>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#1a0a2e', margin: 0 }}>Print Barcode Labels</h2>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0' }}>Supports 58mm Bluetooth thermal printers</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8', borderRadius: '8px' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
          {/* Label Preview */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#9333ea', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Preview</div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              {(format === '58mm' ? [0] : [0, 1]).map(i => (
                <div key={i} style={{
                  width: format === '58mm' ? '200px' : '144px',
                  height: format === '58mm' ? '120px' : '144px',
                  border: '1px solid #ccc',
                  padding: format === '58mm' ? '6px 8px' : '4px',
                  fontFamily: 'Arial, sans-serif', background: 'white',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden'
                }}>
                  <div style={{ fontSize: format === '58mm' ? '8px' : '7px', fontWeight: 700, textAlign: 'center', width: '100%' }}>{shopName}</div>
                  <div style={{ fontSize: format === '58mm' ? '10px' : '8px', fontWeight: 600, textAlign: 'center', width: '100%', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {selectedProduct?.name || 'Product Name'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: format === '58mm' ? '8px' : '6.5px', color: '#333', padding: '0 1px' }}>
                    <span>{selectedProduct?.design_no || 'D001'}</span>
                    <span>{selectedProduct?.colour || 'Blue'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: format === '58mm' ? '8px' : '6.5px', color: '#333', padding: '0 1px' }}>
                    <span>{selectedProduct?.pcode || ''}</span>
                    <span style={{ fontWeight: 600 }}>{selectedProduct?.size || 'XL'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '1px', margin: '1px 0' }}>
                    <span style={{ fontSize: format === '58mm' ? '11px' : '9px', fontWeight: 600 }}>₹</span>
                    <span style={{ fontSize: format === '58mm' ? '24px' : '22px', fontWeight: 700, lineHeight: 1 }}>
                      {selectedProduct?.mrp || selectedProduct?.unit_price || '0'}
                    </span>
                  </div>
                  <div style={{ background: '#f0f0f0', height: '28px', width: format === '58mm' ? '180px' : '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', color: '#666' }}>
                    ▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '6px', marginTop: '2px', padding: '0 2px' }}>
                    <span>{selectedProduct?.batch_no || selectedProduct?.sku || ''}</span>
                    <span>{selectedProduct?.batch_no || selectedProduct?.sku || ''}</span>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
              {format === '58mm' ? '58mm — 1 label per row (Bluetooth thermal)' : '38×38mm — 2 labels per row'}
            </p>
          </div>

          {/* Format */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#9333ea', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Label Format</div>
            {FORMAT_OPTIONS.map(opt => (
              <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', border: `1px solid ${format === opt.value ? '#c084fc' : '#f3e8ff'}`, borderRadius: '10px', marginBottom: '6px', cursor: 'pointer', background: format === opt.value ? '#fdf8ff' : 'white' }}>
                <input type="radio" name="format" value={opt.value} checked={format === opt.value} onChange={() => setFormat(opt.value)} style={{ accentColor: '#9333ea', marginTop: '2px' }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a0a2e' }}>{opt.label}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>

          {/* Global Copies */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#9333ea', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Copies Per Product</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button onClick={() => setGlobalCopies(c => Math.max(1, c - 1))} style={{ width: '32px', height: '32px', border: '1px solid #f3e8ff', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '16px', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
              <input
                type="number" value={globalCopies} min={1} max={999}
                onChange={e => setGlobalCopies(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: '60px', textAlign: 'center', border: '1px solid #f3e8ff', borderRadius: '8px', padding: '6px', fontSize: '14px', fontWeight: 600, color: '#1a0a2e', fontFamily: 'DM Mono, monospace', outline: 'none' }}
              />
              <button onClick={() => setGlobalCopies(c => Math.min(999, c + 1))} style={{ width: '32px', height: '32px', border: '1px solid #f3e8ff', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '16px', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>labels per product</span>
            </div>
          </div>

          {/* Product List */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#9333ea', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Products ({includedRows.length} selected · {totalLabels} labels)
              </div>
            </div>
            <div style={{ border: '1px solid #f3e8ff', borderRadius: '12px', overflow: 'hidden', maxHeight: '240px', overflowY: 'auto' }}>
              {rows.map(row => (
                <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderBottom: '1px solid #fdf8ff', background: row.included ? 'white' : '#fafafa', opacity: row.included ? 1 : 0.5 }}>
                  <input type="checkbox" checked={row.included} onChange={() => toggleRow(row.id)} style={{ accentColor: '#9333ea', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: '#1a0a2e', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{row.product.name}</div>
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                      {[row.product.size, row.product.colour].filter(Boolean).join(' · ') || row.product.sku}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={row.barcode}
                    onChange={e => updateBarcode(row.id, e.target.value)}
                    placeholder="Barcode"
                    style={{ width: '90px', border: '1px solid #f3e8ff', borderRadius: '6px', padding: '4px 6px', fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#1a0a2e', outline: 'none' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button onClick={() => updateCopies(row.id, row.copies - 1)} style={{ width: '22px', height: '22px', border: '1px solid #f3e8ff', borderRadius: '4px', background: 'white', cursor: 'pointer', fontSize: '12px', color: '#9333ea', padding: 0 }}>−</button>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#1a0a2e', width: '20px', textAlign: 'center', fontFamily: 'DM Mono, monospace' }}>{row.copies}</span>
                    <button onClick={() => updateCopies(row.id, row.copies + 1)} style={{ width: '22px', height: '22px', border: '1px solid #f3e8ff', borderRadius: '4px', background: 'white', cursor: 'pointer', fontSize: '12px', color: '#9333ea', padding: 0 }}>+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        {/* Bluetooth tip */}
        {format === '58mm' && (
          <div style={{ padding: '0 24px 10px', fontSize: '11px', color: '#7c3aed', background: '#fdf8ff', borderTop: '1px solid #f3e8ff', paddingTop: '10px' }}>
            <strong>💡 Bluetooth Printer Tip:</strong> Make sure your 58mm thermal printer is paired in <strong>Windows Settings → Bluetooth & Devices</strong> first, then select it in the browser print dialog that appears.
          </div>
        )}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f3e8ff', display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', border: '1px solid #f3e8ff', borderRadius: '12px', background: 'white', color: '#64748b', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          <button
            onClick={handlePrint}
            disabled={totalLabels === 0}
            style={{ flex: 2, padding: '11px', background: totalLabels === 0 ? '#e9d5ff' : '#9333ea', color: 'white', border: 'none', borderRadius: '12px', fontSize: '13px', fontWeight: 600, cursor: totalLabels === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Printer size={16} /> Print {totalLabels} Label{totalLabels !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
