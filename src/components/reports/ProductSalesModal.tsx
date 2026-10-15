import { X } from 'lucide-react'
import { S } from '../bills/billEditStyles'
import { fmtDate } from '../../utils/date'
import { money } from '../../utils/billEdits'
import { normName } from '../../utils/hsn'

/**
 * Every sale of one product (by name) in the report's period: which bill, which
 * design / size / colour, how many and at what price. The report's "Top Products"
 * groups by name, so this is where the individual pieces behind a name show up.
 */
/** `name` is the product key from Reports (spelling-insensitive), so TOP and top are one product. */
export function ProductSalesModal({ name, sales, onClose }: { name: string; sales: any[]; onClose: () => void }) {
  const lines = sales.flatMap(s => (s.sale_items || [])
    .filter((i: any) => normName(i.products?.name || 'Unknown') === normName(name))
    .map((i: any) => ({ sale: s, item: i })))
  const units = lines.reduce((n, l) => n + (l.item.qty || 0), 0)
  const amount = lines.reduce((n, l) => n + (l.item.line_total || 0), 0)
  const th = { ...S.th, whiteSpace: 'nowrap' as const }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.card, maxWidth: 980 }} onClick={e => e.stopPropagation()}>
        <div style={S.head}>
          <div>
            <div style={S.title}>{lines[0]?.item?.products?.name || name}</div>
            <div style={S.sub}>{units} unit{units === 1 ? '' : 's'} sold · {money(amount)} · {lines.length} line{lines.length === 1 ? '' : 's'} on {new Set(lines.map(l => l.sale.id)).size} bill(s)</div>
          </div>
          <button style={S.x} onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div style={{ ...S.body, overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                {['Date', 'Invoice', 'Customer', 'Design', 'Size', 'Colour', 'Barcode'].map(h => <th key={h} style={th}>{h}</th>)}
                {['Qty', 'Rate', 'Amount'].map(h => <th key={h} style={{ ...th, textAlign: 'right' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {lines.map((l, k) => (
                <tr key={k}>
                  <td style={{ ...S.td, whiteSpace: 'nowrap' }}>{fmtDate(l.sale.created_at)}</td>
                  <td style={{ ...S.td, fontWeight: 600, whiteSpace: 'nowrap' }}>{l.sale.invoice_no}</td>
                  <td style={S.td}>{l.sale.customers?.name || 'Walk-in'}</td>
                  <td style={S.td}>{l.item.products?.design_no || '—'}</td>
                  <td style={S.td}>{l.item.products?.size || '—'}</td>
                  <td style={S.td}>{l.item.products?.colour || '—'}</td>
                  <td style={{ ...S.td, fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{l.item.products?.barcode || '—'}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>{l.item.qty}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>{money(l.item.unit_price)}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{money(l.item.line_total)}</td>
                </tr>
              ))}
              {!lines.length && <tr><td colSpan={10} style={{ ...S.td, textAlign: 'center', color: '#94a3b8' }}>No sales found</td></tr>}
              {lines.length > 0 && (
                <tr>
                  <td colSpan={7} style={{ ...S.td, fontWeight: 700 }}>Total</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>{units}</td>
                  <td style={S.td} />
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>{money(amount)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
