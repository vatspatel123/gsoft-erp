/**
 * Write a completed bill to the permanent bill journal on this PC (desktop app only).
 * Never throws and never waits: the sale must not depend on it.
 */
export type JournalStatus = 'saved' | 'queued' | 'synced' | 'deleted' | 'replaced'

export function journalBill(status: JournalStatus, sale: any, reason?: string): void {
  try {
    const api = window.electronAPI?.journal
    if (!api || !sale) return
    void api.add({
      status, reason: reason || undefined,
      invoiceNo: sale.invoiceNo || sale.invoice_no,
      date: sale.date || sale.createdAt,
      customer: sale.customer ? { id: sale.customer.id, name: sale.customer.name, phone: sale.customer.phone } : null,
      salesman: { id: sale.salesmanId || null, name: sale.salesmanName || null },
      totals: {
        subtotal: sale.subtotal, discount: sale.totalDiscount, gst: sale.gstAmount, net: sale.netAmount,
        paymentMode: sale.paymentMode, tenders: sale.tenders, credit: sale.creditRemainder,
      },
      items: (sale.cart || []).map((i: any) => ({
        productId: i.product?.id, name: i.product?.name, barcode: i.product?.barcode, design: i.product?.design_no,
        size: i.product?.size, colour: i.product?.colour, qty: i.qty, unitPrice: i.unit_price, discountPct: i.discount_pct, lineTotal: i.line_total,
      })),
    }).catch(() => {})
  } catch { /* the journal is a safety net, never a reason to fail a sale */ }
}
