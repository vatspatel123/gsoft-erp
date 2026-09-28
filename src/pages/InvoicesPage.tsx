import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/shared/Layout'
import { useInvoices, type Invoice } from '../hooks/useInvoices'
import { printBill, buildBillHTML, buildBillMessage } from '../utils/printBill'
import { exportToCSV } from '../utils/exportCSV'
import {
  ShoppingBag,
  IndianRupee,
  TrendingUp,
  Receipt,
  Download,
  Eye,
  Printer,
  MessageCircle,
  RotateCcw,
  ArrowLeftRight,
  Search,
  Loader2,
  Pencil
} from 'lucide-react'
import '../styles/invoices.css'
import { sendWhatsApp, sendWhatsAppDocument } from '../utils/whatsapp'
import toast from 'react-hot-toast'
import { EditSaleModal } from '../components/bills/EditSaleModal'
import { BillHistoryModal } from '../components/bills/BillHistoryModal'

export function InvoicesPage() {
  const {
    invoices,
    loading,
    search,
    setSearch,
    paymentFilter,
    setPaymentFilter,
    salesmanFilter,
    setSalesmanFilter,
    dateRange,
    setDateRange,
    salesmen,
    totalRevenue,
    totalGST,
    avgBillValue,
    paymentBreakdown,
    processRefund,
    fetchInvoices
  } = useInvoices()

  const navigate = useNavigate()
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [refundConfirm, setRefundConfirm] = useState<Invoice | null>(null)
  const [isRefunding, setIsRefunding] = useState(false)
  const [editingSale, setEditingSale] = useState<string | null>(null)
  const [historySale, setHistorySale] = useState<{ id: string; no: string } | null>(null)
  // Bills saved offline have no database row yet, so there is nothing to edit.
  const editable = (inv: Invoice) => !inv.is_return && /^[0-9a-f-]{36}$/i.test(String(inv.id))

  // Rebuild the sale exactly as the POS had it, so a reprint or a re-send
  // produces the same bill the customer was originally handed.
  const saleDataFrom = (invoice: Invoice) => ({
    invoiceNo: invoice.invoice_no,
    cart: invoice.sale_items?.map((item) => ({
      product: {
        name: item.products?.name || 'Product',
        gst_rate: item.products?.gst_rate || 0,
        design_no: item.products?.design_no,
        size: item.products?.size,
        colour: item.products?.colour,
        barcode: item.products?.barcode,
        category: item.products?.categories?.name,
      },
      qty: item.qty,
      unit_price: item.unit_price,
      discount_pct: item.discount_pct || 0,
      line_total: item.line_total,
    })) || [],
    customer: invoice.customers || null,
    subtotal: invoice.total_amount,
    gstAmount: invoice.gst_amount,
    totalDiscount: invoice.discount_amount || 0,
    netAmount: invoice.net_amount,
    paymentMode: invoice.payment_mode,
    tenders: {
      cash: invoice.cash_amount || 0,
      card: invoice.card_amount || 0,
      upi: invoice.upi_amount || 0,
    },
    creditRemainder: invoice.credit_amount || 0,
    creditDueDate: invoice.credit_due_date,
    creditDueDays: invoice.credit_due_days,
    salesmanName: invoice.users?.name,
    date: invoice.created_at,
  })

  const handleReprint = (invoice: Invoice) => printBill(saleDataFrom(invoice))

  const handleResendWhatsApp = async (invoice: Invoice) => {
    const phone = invoice.customers?.phone
    if (!phone) {
      toast.error('Customer phone number not available')
      return
    }
    const saleData = saleDataFrom(invoice)
    const how = await sendWhatsAppDocument(phone, {
      html: buildBillHTML(saleData),
      caption: buildBillMessage(saleData),
      fileName: `Invoice-${invoice.invoice_no}.pdf`,
    })
    if (how === 'browser') toast.success('WhatsApp opened')
  }

  const send15DayOverdueReminder = (invoice: Invoice) => {
    if (!invoice.customers?.phone) {
      toast.error('Customer phone number not available')
      return
    }
    const cleanPhone = invoice.customers.phone.replace(/\D/g, '')
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone
    const dateStr = new Date(invoice.created_at).toLocaleDateString('en-IN')

    const msg =
      `*🔔 PAYMENT REMINDER — OUTSTANDING BILL*%0A%0A` +
      `નમસ્તે *${invoice.customers.name}*,%0A` +
      `આપનું બિલ નંબર *#${invoice.invoice_no}* (તારીખ: ${dateStr}) નું બાકી રકમ *₹${Number(invoice.net_amount).toFixed(2)}* છે.%0A` +
      `કૃપા કરીને વહેલી તકે ચુકવણી કરશો. આભાર!%0A%0A` +
      `_Dear ${invoice.customers.name}, gentle reminder regarding your outstanding bill #${invoice.invoice_no} of ₹${Number(invoice.net_amount).toFixed(2)} dated ${dateStr}._`

    sendWhatsApp(fullPhone, msg, { encoded: true })
  }

  const handleExportCSV = () => {
    const exportData = invoices.map((inv) => ({
      ...inv,
      customer_name: inv.customers?.name || 'Walk-in',
      salesman_name: inv.users?.name || 'Unknown',
      created_at: new Date(inv.created_at).toLocaleString('en-IN')
    }))

    const columns = [
      { key: 'invoice_no', label: 'Invoice No' },
      { key: 'created_at', label: 'Date' },
      { key: 'customer_name', label: 'Customer' },
      { key: 'net_amount', label: 'Amount' },
      { key: 'gst_amount', label: 'GST' },
      { key: 'discount_amount', label: 'Discount' },
      { key: 'payment_mode', label: 'Payment' },
      { key: 'salesman_name', label: 'Salesman' }
    ]

    exportToCSV(exportData, 'sales_export', columns)
  }

  const handleRefund = async (invoice: Invoice) => {
    setRefundConfirm(null)
    setIsRefunding(true)
    await processRefund(invoice)
    setIsRefunding(false)
  }

  const getPaymentModeColor = (mode: string) => {
    switch (mode) {
      case 'cash':
        return 'payment-badge-cash'
      case 'card':
        return 'payment-badge-card'
      case 'upi':
        return 'payment-badge-upi'
      case 'credit':
        return 'payment-badge-credit'
      default:
        return 'payment-badge-cash'
    }
  }

  const getPaymentModeBadgeColor = (mode: string) => {
    switch (mode) {
      case 'cash':
        return '#f5f5f5'
      case 'card':
        return '#dbeafe'
      case 'upi':
        return '#dcfce7'
      case 'credit':
        return '#fed7aa'
      default:
        return '#f5f5f5'
    }
  }

  const selectedSalesmanName = salesmen.find((s) => s.id === salesmanFilter)?.name || ''

  const getPaymentModeTextColor = (mode: string) => {
    switch (mode) {
      case 'cash':
        return '#6b7280'
      case 'card':
        return '#1e40af'
      case 'upi':
        return '#15803d'
      case 'credit':
        return '#b45309'
      default:
        return '#6b7280'
    }
  }

  const getInitials = (name?: string) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <Layout>
      <div className="invoices-page">
        {/* Top Bar */}
        <div className="invoices-top-bar">
          <h1 className="invoices-heading">Sales & Invoices</h1>
          <div className="invoices-top-right">
            <button className="btn-export" onClick={handleExportCSV}>
              <Download size={16} style={{ marginRight: '6px' }} />
              Export CSV
            </button>
            <div className="date-filter">
              <button
                className={`date-btn ${dateRange === 'today' ? 'active' : ''}`}
                onClick={() => setDateRange('today')}
              >
                Today
              </button>
              <button
                className={`date-btn ${dateRange === 'week' ? 'active' : ''}`}
                onClick={() => setDateRange('week')}
              >
                This Week
              </button>
              <button
                className={`date-btn ${dateRange === 'month' ? 'active' : ''}`}
                onClick={() => setDateRange('month')}
              >
                This Month
              </button>
            </div>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="stat-cards">
          <div className="stat-card">
            <div className="stat-icon stat-icon-1">
              <ShoppingBag size={28} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Total Sales Today</div>
              <div className="stat-value">{invoices.length}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-2">
              <IndianRupee size={28} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Revenue Today</div>
              <div className="stat-value">₹{totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-3">
              <TrendingUp size={28} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Average Bill Value</div>
              <div className="stat-value">₹{avgBillValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-4">
              <Receipt size={28} />
            </div>
            <div className="stat-content">
              <div className="stat-label">Total GST Collected</div>
              <div className="stat-value">₹{totalGST.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="invoices-filters">
          <div className="filter-row">
            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search by invoice no or customer name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="filter-select"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              style={paymentFilter === 'credit_overdue_15' ? { borderColor: '#ef4444', color: '#dc2626', fontWeight: 700 } : {}}
            >
              <option value="all">All Payment Modes</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
              <option value="credit">Credit (All)</option>
              <option value="credit_overdue_15">⚠️ Overdue Credit (&gt; 15 Days)</option>
            </select>
            <select
              className="filter-select"
              value={salesmanFilter}
              onChange={(e) => setSalesmanFilter(e.target.value)}
            >
              <option value="all">All Salesmen</option>
              {salesmen.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Payment Summary */}
        {invoices.length > 0 && (
          <div className="payment-summary">
            {Object.entries(paymentBreakdown).map(([mode, bills]) => {
              if (bills.length === 0) return null
              const total = bills.reduce((sum, b) => sum + b.net_amount, 0)
              return (
                <div key={mode} className="payment-item">
                  <span className={`payment-badge ${getPaymentModeColor(mode)}`}>
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </span>
                  <div>
                    <div className="payment-amount">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                    <div className="payment-count">({bills.length} {bills.length === 1 ? 'bill' : 'bills'})</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Invoices Table */}
        {salesmanFilter !== 'all' && selectedSalesmanName && (
          <div style={{ color: '#9333ea', fontWeight: 600, marginBottom: '10px' }}>
            Showing: {selectedSalesmanName}'s sales
          </div>
        )}
        <div className="invoices-table-card">
          {loading ? (
            <div className="loading-spinner">
              <Loader2 size={24} className="spinner" />
              <span>Loading invoices...</span>
            </div>
          ) : invoices.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-title">No Invoices Found</div>
              <div className="empty-state-message">Create your first sale from the POS page to see invoices here.</div>
            </div>
          ) : (
            <div className="invoices-table-container">
              <table className="invoices-table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Date & Time</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Salesman</th>
                    <th>Payment</th>
                    <th>Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} style={{ opacity: invoice.is_return ? 0.7 : 1 }}>
                      <td>
                        <span className="invoice-no">{invoice.invoice_no}</span>
                        {invoice.is_return && <div className="refunded-badge">REFUNDED</div>}
                        {(invoice.edit_count || 0) > 0 && (
                          <button
                            onClick={() => setHistorySale({ id: invoice.id, no: invoice.invoice_no })}
                            title="See what was changed"
                            style={{ display: 'block', marginTop: 4, padding: '2px 8px', borderRadius: 20, background: '#fef3c7',
                                     color: '#92400e', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer' }}
                          >
                            Edited {invoice.edit_count}×
                          </button>
                        )}
                      </td>
                      <td>
                        <div className="date-time">
                          <div className="date-time-date">
                            {new Date(invoice.created_at).toLocaleDateString('en-IN')}
                          </div>
                          <div className="date-time-time">
                            {new Date(invoice.created_at).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="customer-cell">
                          <div
                            className={`customer-avatar ${
                              invoice.customers ? 'customer-avatar-purple' : 'customer-avatar-grey'
                            }`}
                          >
                            {getInitials(invoice.customers?.name)}
                          </div>
                          <span className="customer-name">
                            {invoice.customers?.name || 'Walk-in'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="items-badge">
                          {invoice.sale_items?.length || 0} item{(invoice.sale_items?.length || 0) !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td>
                        <div className="salesman-cell">
                          {invoice.users ? (
                            <>
                              <div className="salesman-avatar">{getInitials(invoice.users.name)}</div>
                              <span className="salesman-name">{invoice.users.name}</span>
                            </>
                          ) : (
                            <span className="salesman-name" style={{ color: '#94a3b8' }}>
                              —
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          className="payment-badge"
                          style={{
                            backgroundColor: getPaymentModeBadgeColor(invoice.payment_mode),
                            color: getPaymentModeTextColor(invoice.payment_mode)
                          }}
                        >
                          {invoice.payment_mode.charAt(0).toUpperCase() + invoice.payment_mode.slice(1)}
                        </span>
                      </td>
                      <td>
                        <div
                          className="amount-cell"
                          style={{
                            textDecoration: invoice.is_return ? 'line-through' : 'none',
                            opacity: invoice.is_return ? 0.6 : 1
                          }}
                        >
                          <div className="amount-net">
                            ₹{invoice.net_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </div>
                          <div className="amount-gst">
                            GST: ₹{invoice.gst_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="actions-cell">
                          <button
                            className="action-btn primary"
                            onClick={() => setSelectedInvoice(invoice)}
                            title="View Invoice"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            className="action-btn primary"
                            onClick={() => handleReprint(invoice)}
                            title="Print Invoice"
                          >
                            <Printer size={16} />
                          </button>
                          <button
                            className="action-btn primary"
                            onClick={() => handleResendWhatsApp(invoice)}
                            title="Send WhatsApp Invoice"
                            disabled={!invoice.customers?.phone}
                          >
                            <MessageCircle size={16} />
                          </button>
                          {invoice.payment_mode === 'credit' && !invoice.is_return && (
                            <button
                              className="action-btn"
                              onClick={() => send15DayOverdueReminder(invoice)}
                              title="Send 15-Day Payment Reminder WhatsApp"
                              style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
                              disabled={!invoice.customers?.phone}
                            >
                              🔔
                            </button>
                          )}
                          {editable(invoice) && (
                            <button
                              className="action-btn primary"
                              onClick={() => setEditingSale(invoice.id)}
                              title="Edit bill"
                            >
                              <Pencil size={16} />
                            </button>
                          )}
                          {!invoice.is_return && (
                            <button
                              className="action-btn refund"
                              onClick={() => setRefundConfirm(invoice)}
                              title="Process Refund"
                            >
                              <RotateCcw size={16} />
                            </button>
                          )}
                          {!invoice.is_return && (
                            <button
                              className="action-btn primary"
                              onClick={() => navigate(`/exchange?invoice=${invoice.invoice_no}`)}
                              title="Exchange / Return"
                              style={{ color: '#9333ea' }}
                            >
                              <ArrowLeftRight size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="modal-overlay" onClick={() => setSelectedInvoice(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-shop-name">Retail ERP</div>
              <div className="modal-shop-sub">Fashion Edition · Ahmedabad</div>
            </div>

            <div className="modal-body">
              {/* Invoice Info */}
              <div className="invoice-info">
                <div className="info-item">
                  <div className="info-label">Invoice</div>
                  <div className="info-value">{selectedInvoice.invoice_no}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Date & Time</div>
                  <div className="info-value">
                    {new Date(selectedInvoice.created_at).toLocaleDateString('en-IN')}, {''}
                    {new Date(selectedInvoice.created_at).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                {selectedInvoice.users && (
                  <div className="info-item">
                    <div className="info-label">Salesman</div>
                    <div className="info-value">{selectedInvoice.users.name}</div>
                  </div>
                )}
                <div className="info-item">
                  <div className="info-label">Counter</div>
                  <div className="info-value">{selectedInvoice.counter_id || 'Counter 1'}</div>
                </div>
              </div>

              {/* Customer Info */}
              {selectedInvoice.customers && (
                <div className="invoice-info">
                  <div className="info-item">
                    <div className="info-label">Customer</div>
                    <div className="info-value">{selectedInvoice.customers.name}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Phone</div>
                    <div className="info-value">{selectedInvoice.customers.phone}</div>
                  </div>
                </div>
              )}

              {/* Items */}
              {selectedInvoice.sale_items && selectedInvoice.sale_items.length > 0 && (
                <div className="items-section">
                  <div className="items-title">Items</div>
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Qty</th>
                        <th className="item-price">Price</th>
                        <th className="item-price">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.sale_items.map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.products?.name || 'Product'}</td>
                          <td className="item-qty">{item.qty}</td>
                          <td className="item-price">
                            ₹{item.unit_price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </td>
                          <td className="item-total">
                            ₹{item.line_total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Totals */}
              <div className="totals-section">
                <div className="total-row subtotal">
                  <span>Subtotal</span>
                  <span>₹{selectedInvoice.total_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="total-row subtotal">
                  <span>GST ({selectedInvoice.sale_items?.[0]?.gst_rate || 0}%)</span>
                  <span>₹{selectedInvoice.gst_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                {selectedInvoice.discount_amount > 0 && (
                  <div className="total-row discount">
                    <span>Discount</span>
                    <span>-₹{selectedInvoice.discount_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="total-row net">
                  <span>Net Payable</span>
                  <span>₹{selectedInvoice.net_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Payment Mode */}
              <div className="payment-mode-section">
                <span
                  className="payment-mode-badge"
                  style={{
                    backgroundColor: getPaymentModeBadgeColor(selectedInvoice.payment_mode),
                    color: getPaymentModeTextColor(selectedInvoice.payment_mode)
                  }}
                >
                  {selectedInvoice.payment_mode.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="modal-footer">Thank you for shopping!</div>

            {/* Actions */}
            <div className="modal-actions">
              <button
                className="btn-modal btn-modal-primary"
                onClick={() => {
                  handleReprint(selectedInvoice)
                  setSelectedInvoice(null)
                }}
              >
                <Printer size={16} style={{ marginRight: '6px' }} />
                Print Bill
              </button>
              <button
                className="btn-modal btn-modal-success"
                onClick={() => {
                  handleResendWhatsApp(selectedInvoice)
                  setSelectedInvoice(null)
                }}
                disabled={!selectedInvoice.customers?.phone}
              >
                <MessageCircle size={16} style={{ marginRight: '6px' }} />
                Send WhatsApp
              </button>
              <button className="btn-modal btn-modal-outline" onClick={() => setSelectedInvoice(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Confirmation Dialog */}
      {refundConfirm && (
        <div className="confirm-dialog" onClick={() => setRefundConfirm(null)}>
          <div className="confirm-content" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-title">⚠️ Confirm Refund</div>
            <div className="confirm-message">
              Mark invoice <strong>{refundConfirm.invoice_no}</strong> as refunded? This will add back stock and deduct
              from sales.
            </div>
            <div className="confirm-buttons">
              <button
                className="btn-confirm btn-confirm-cancel"
                onClick={() => setRefundConfirm(null)}
                disabled={isRefunding}
              >
                Cancel
              </button>
              <button
                className="btn-confirm btn-confirm-danger"
                onClick={() => handleRefund(refundConfirm)}
                disabled={isRefunding}
              >
                {isRefunding ? 'Processing...' : 'Confirm Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
      {editingSale && (
        <EditSaleModal saleId={editingSale} onClose={() => setEditingSale(null)} onSaved={() => fetchInvoices()} />
      )}
      {historySale && (
        <BillHistoryModal type="sale" billId={historySale.id} billNo={historySale.no} onClose={() => setHistorySale(null)} />
      )}
    </Layout>
  )
}
