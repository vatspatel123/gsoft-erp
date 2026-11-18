import { useState, useEffect } from 'react';
import { Layout } from '../shared/Layout';
import { usePOS } from '../../hooks/usePOS';
import { RoleBadge, getRoleStyle } from '../shared/RoleBadge';
import { ProductSearch } from './ProductSearch';
import { Cart } from './Cart';
import { OrderSummary } from './OrderSummary';
import { BillModal } from './BillModal';
import { AddProductModal } from './AddProductModal';
import { OldLotAlertModal } from './OldLotAlertModal';
import { CustomerHistoryModal } from '../customers/CustomerHistoryModal';
import { getCachedSalesmen, saveSalesmenToCache, getPendingSales, clearPendingSale, holdPendingSale } from '../../utils/offlineCache';
import { findCustomerByPhone } from '../../utils/customerLookup';
import { journalBill } from '../../utils/billJournal';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { editSale, billEditPayload, money } from '../../utils/billEdits';
import { S } from '../bills/billEditStyles';
import '../../styles/pos.css';

export default function POSScreen() {
  const navigate = useNavigate();
  const [salesmen, setSalesmen] = useState<any[]>([]);
  const [selectedSalesman, setSelectedSalesman] = useState<any>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<any>(null);
  const [salesmenLoaded, setSalesmenLoaded] = useState(false);
  // An unsent bill being re-made here (Invoices -> Edit on a bill that is only on this PC).
  const [rebillOf, setRebillOf] = useState<{ pendingId: number; invoiceNo: string } | null>(null);

  useEffect(() => {
    const fetchSalesmen = async () => {
      let fetched: any[] = []
      if (navigator.onLine) {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('id, name, role, is_active')
            .order('name')
          if (!error && data && data.length > 0) {
            fetched = data
            saveSalesmenToCache(data)
          }
        } catch (dbErr) {
          console.warn('Network error fetching salesmen, using cache:', dbErr)
        }
      }

      const cached = getCachedSalesmen() || []
      const map = new Map<string, any>()
      for (const s of cached) if (s.is_active !== false) map.set(s.id, s)
      for (const s of fetched) if (s.is_active !== false) map.set(s.id, s)

      const merged = Array.from(map.values())
      setSalesmen(merged)
      setSalesmenLoaded(true)
    }
    fetchSalesmen()
  }, [])

  const pos = usePOS(selectedSalesman?.id || null);

  // Fill the screen from an unsent bill: same salesman, same customer (the real saved one if the phone
  // is already a customer), same items at today's stock and price. Nothing is saved until the
  // bill is completed; then the old unsent bill is removed so it is not counted twice.
  useEffect(() => {
    if (!salesmenLoaded) return
    let raw: string | null = null
    try { raw = sessionStorage.getItem('pos_rebill'); if (raw) sessionStorage.removeItem('pos_rebill') } catch { /* nothing to open */ }
    if (!raw) return
    void (async () => {
      try {
        const r = JSON.parse(raw as string)
        const sm = salesmen.find(s => s.id === r.salesmanId)
        if (sm) setSelectedSalesman(sm)
        const real = r.customer?.phone ? await findCustomerByPhone(r.customer.phone) : null
        if (r.customer) pos.selectCustomer(real || r.customer)
        const ids = (r.items || []).map((i: any) => i.productId).filter(Boolean)
        const { data } = ids.length ? await supabase.from('products').select('*, categories(name)').in('id', ids) : { data: [] as any[] }
        const fresh = new Map((data || []).map((p: any) => [p.id, p]))
        for (const it of r.items || []) {
          const prod = fresh.get(it.productId) || it.product
          if (!prod) continue
          for (let n = 0; n < (Number(it.qty) || 1); n++) await pos.addToCart(prod, true)
        }
        if (r.note) setBillNote(r.note)
        if (r.alterationQty) setAlterationQty(Number(r.alterationQty) || 0)
        setRebillOf({ pendingId: r.pendingId, invoiceNo: r.invoiceNo })
        toast(`Re-making ${r.invoiceNo}: check the items, then complete the bill`, { icon: '✏️', duration: 6000 })
      } catch { toast.error('Could not open the unsent bill here') }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesmenLoaded])
  // Invoices -> Edit: this same screen, filled with a saved bill. "Save Changes" runs the database's own
  // edit (stock moves by the difference, the old version goes to the bill's history). Nothing else about
  // making a bill changes: everything below only switches on while editOf is set.
  const [editOf, setEditOf] = useState<null | {
    id: string; invoiceNo: string; customerId: string; salesmanId: string; origQty: Record<string, number>
  }>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [editPw, setEditPw] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!salesmenLoaded) return
    let id: string | null = null
    try { id = sessionStorage.getItem('pos_edit'); if (id) sessionStorage.removeItem('pos_edit') } catch { /* nothing to open */ }
    if (!id) return
    void (async () => {
      const { data: sale, error } = await supabase.from('sales')
        .select('*, customers(*), users(name), sale_items(product_id, qty, unit_price, discount_pct)')
        .eq('id', id).single()
      if (error || !sale) { toast.error('Could not open this bill for editing'); return }
      if (sale.is_return) { toast.error('A return cannot be edited'); return }
      const ids = (sale.sale_items || []).map((i: any) => i.product_id).filter(Boolean)
      const { data: prods } = ids.length ? await supabase.from('products').select('*, categories(name)').in('id', ids) : { data: [] as any[] }
      const byId = new Map((prods || []).map((p: any) => [p.id, p]))
      if ((sale.sale_items || []).some((i: any) => !byId.get(i.product_id))) { toast.error('An item on this bill is no longer in the product list'); return }
      // The bill's own pieces are already off the shelf: they count as available to this bill.
      const origQty: Record<string, number> = {}
      for (const i of sale.sale_items || []) origQty[i.product_id] = (origQty[i.product_id] || 0) + Number(i.qty)
      const items = (sale.sale_items || []).map((i: any) => {
        const p: any = byId.get(i.product_id)
        const qty = Number(i.qty), rate = Number(i.unit_price), d = Number(i.discount_pct) || 0
        return { product: { ...p, stock_qty: (Number(p.stock_qty) || 0) + (origQty[i.product_id] || 0) }, qty, unit_price: rate, discount_pct: d, line_total: rate * qty * (1 - d / 100) }
      })
      const sid = sale.salesman_id || ''
      let sm = salesmen.find(x => x.id === sid) || null
      if (sid && !sm) {   // a salesman who is no longer active is still the bill's salesman
        sm = { id: sid, name: sale.users?.name || 'Salesman', role: 'staff', is_active: true }
        setSalesmen(prev => [...prev, sm])
      }
      setSelectedSalesman(sm)
      pos.selectCustomer(sale.customers || null)
      pos.loadBill({
        items, discount: Number(sale.discount_amount) || 0, shipping: Number(sale.shipping_amount) || 0,
        tenders: { cash: Number(sale.cash_amount) || 0, card: Number(sale.card_amount) || 0, upi: Number(sale.upi_amount) || 0 },
        creditNote: Number(sale.credit_note_amount) || 0,
      })
      setBillNote(sale.note || '')
      setAlterationQty(Number(sale.alteration_qty) || 0)
      setEditOf({ id: sale.id, invoiceNo: sale.invoice_no, customerId: sale.customer_id || '', salesmanId: sid, origQty })
      toast(`Editing ${sale.invoice_no}: change what is needed, then press Save Changes`, { icon: '✏️', duration: 6000 })
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesmenLoaded])

  const leaveEdit = (message?: string) => {
    if (message) toast.success(message)
    setEditOf(null); setSaveOpen(false); setEditReason(''); setEditPw('')
    navigate('/invoices')
  }

  const saveEdit = async () => {
    if (!editOf) return
    const pay = billEditPayload({
      cart: pos.cart, origQty: editOf.origQty,
      discount: pos.manualDiscountAmount, shipping: pos.shipping,
      tenders: pos.tenders, screenPending: pos.creditRemainder, creditNote: pos.creditNotePaid,
      note: billNote, alteration: alterationQty,
      customerId: pos.customer?.id || '', origCustomerId: editOf.customerId,
      salesmanId: selectedSalesman?.id || '', origSalesmanId: editOf.salesmanId,
    })
    if (!pos.cart.length) { toast.error('A bill needs at least one item'); return }
    if (editReason.trim().length < 3) { toast.error('Please write why this bill is being edited'); return }
    if (pay.salesmanChanged && !editPw) { toast.error('Changing the salesman needs the admin password'); return }
    setSavingEdit(true)
    const res = await editSale(editOf.id, pay.changes, pay.lines, editReason.trim(),
      pay.salesmanChanged ? { login: '', password: editPw } : undefined)
    setSavingEdit(false)
    if (!res.ok) { toast.error(res.error, { duration: 6000 }); return }
    leaveEdit(`Bill ${editOf.invoiceNo} updated${res.udhar > 0 ? ` · pending ${money(res.udhar)}` : ''}`)
  }

  // While editing, a piece the bill already holds is not counted against the shelf twice.
  const selectProduct = (p: any) => {
    if (!editOf) return pos.addToCart(p)
    return pos.addToCart({ ...p, stock_qty: (Number(p.stock_qty) || 0) + (editOf.origQty[p.id] || 0) })
  }
  const [showModal, setShowModal] = useState(false);
  const [completedSaleData, setCompletedSaleData] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addProductBarcode, setAddProductBarcode] = useState('');
  const [billNote, setBillNote] = useState('');
  const [alterationQty, setAlterationQty] = useState(0);   // pieces going to the alteration tailor
  // Bumped after every bill: the search box and payment panel start over blank,
  // and so does the salesman — the next bill is a new sale, not a copy of the last.
  const [billKey, setBillKey] = useState(0);
  const startFresh = () => {
    pos.clearCart();
    setBillNote('');
    setAlterationQty(0);
    setSelectedSalesman(null);
    setBillKey(k => k + 1);
  };

  const handleCompleteSale = async () => {
    if (editOf) { setSaveOpen(true); return }
    if (!selectedSalesman) {
      toast.error('⚠️ Please select a salesperson before completing the sale', { duration: 3000 });
      return;
    }
    const saleData = await pos.completeSale({ note: billNote, alterationQty });
    if (saleData) {
      if (rebillOf) {
        const old = getPendingSales().find((s: any) => s.pendingId === rebillOf.pendingId)
        if (old) journalBill('replaced', old, `re-made as ${saleData.invoiceNo}`)
        clearPendingSale(rebillOf.pendingId)
        setRebillOf(null)
      }
      // Store sale data BEFORE clearing cart so the modal can still display it
      setCompletedSaleData(saleData);
      setShowModal(true);
      // Everything back to blank for the next sale (behind the modal)
      startFresh();
    }
  };

  const handleNewSale = () => {
    startFresh()
    setTimeout(() => {
      const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
      if (searchInput) searchInput.focus()
    }, 100)
  };

  const handleOpenAddProduct = (barcode?: string) => {
    setAddProductBarcode(barcode || '');
    setShowAddModal(true);
  };


  return (
    <Layout>
      <div className="pos-screen">
        <div className="pos-left">
          {editOf && (
            <div style={{ background: '#faf5ff', border: '1px solid #d8b4fe', borderRadius: '12px', padding: '10px 14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ color: '#6b21a8', fontWeight: 700, fontSize: '13px' }}>✏️ Editing bill {editOf.invoiceNo}</span>
              <span style={{ color: '#7c3aed', fontSize: '12px' }}>Change what is needed, then press Save Changes. Stock and the pending amount follow the difference; the old version is kept in the bill's history.</span>
              <button onClick={() => { startFresh(); leaveEdit() }}
                style={{ marginLeft: 'auto', background: 'white', color: '#7c3aed', border: '1px solid #d8b4fe', borderRadius: '8px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer' }}>
                Cancel (bill stays as it was)
              </button>
            </div>
          )}
          {rebillOf && (
            <div style={{ background: '#faf5ff', border: '1px solid #d8b4fe', borderRadius: '12px', padding: '10px 14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ color: '#6b21a8', fontWeight: 700, fontSize: '13px' }}>✏️ Re-making unsent bill {rebillOf.invoiceNo}</span>
              <span style={{ color: '#7c3aed', fontSize: '12px' }}>Check the items, then complete the bill. The old unsent bill is removed automatically.</span>
              <button onClick={() => { holdPendingSale(rebillOf.pendingId, false); setRebillOf(null); pos.clearCart(); setSelectedSalesman(null) }}
                style={{ marginLeft: 'auto', background: 'white', color: '#7c3aed', border: '1px solid #d8b4fe', borderRadius: '8px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer' }}>
                Cancel (keep the old bill)
              </button>
            </div>
          )}

          {/* Salesman Selector */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 16px',
            background: 'white',
            border: '1px solid #f3e8ff',
            borderRadius: '12px',
            marginBottom: '12px'
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: '500',
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              whiteSpace: 'nowrap'
            }}>
              Salesman
            </div>
            <select
              value={selectedSalesman?.id || ''}
              onChange={e => {
                const found = salesmen.find((s: any) => s.id === e.target.value);
                setSelectedSalesman(found || null);
              }}
              style={{
                flex: 1,
                border: '1px solid #f3e8ff',
                borderRadius: '8px',
                padding: '7px 12px',
                fontSize: '13px',
                fontFamily: 'DM Sans, sans-serif',
                color: '#1a0a2e',
                background: 'white',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="">No Salesman</option>
              {salesmen.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.role}
                </option>
              ))}
            </select>
            {selectedSalesman && (() => {
              const roleStyle = getRoleStyle(selectedSalesman.role || 'staff');
              return (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#f5f3ff',
                  color: '#1a0a2e',
                  padding: '6px 12px',
                  borderRadius: '99px',
                  fontSize: '12px',
                  fontWeight: '500',
                  whiteSpace: 'nowrap'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    background: roleStyle.color,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: '600'
                  }}>
                    {selectedSalesman.name.charAt(0).toUpperCase()}
                  </div>
                  <span>{selectedSalesman.name}</span>
                  <span style={{ color: roleStyle.color, fontWeight: 600 }}>— {roleStyle.label}</span>
                </div>
              );
            })()}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            {/* Search bar and Add Product button on same line */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%'
            }}>
              {/* Search bar — takes all space */}
              <div style={{ flex: 1 }}>
                <ProductSearch key={billKey}
                  onSelect={selectProduct}
                  onOpenAddProduct={handleOpenAddProduct}
                />
              </div>


              {/* Add Product button — fixed width */}
              <button 
                onClick={() => setShowAddModal(true)}
                style={{
                  flexShrink: 0,
                  background: 'white',
                  color: '#9333ea',
                  border: '1px solid #f3e8ff',
                  borderRadius: '10px',
                  padding: '0 16px',
                  height: '46px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                + Add Product
              </button>
            </div>

            {/* Scanner Ready indicator below search bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                marginTop: '0px',
                fontSize: '11px',
                color: searchFocused ? '#16a34a' : '#94a3b8',
                cursor: 'pointer'
              }}
              onClick={() => {
                const input = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
                input?.focus();
                setSearchFocused(true);
              }}
            >
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: searchFocused ? '#16a34a' : '#cbd5e1'
                }}
              />
              {searchFocused ? 'Scanner Ready' : 'Click to scan'}
            </div>
          </div>
          <Cart
            items={pos.cart}
            onUpdateQty={pos.updateQty}
            onUpdateDiscount={pos.updateDiscount}
            onRemove={pos.removeFromCart}
            onUpdatePrice={editOf ? pos.setUnitPrice : undefined}
          />

          {/* Bill note */}
          <textarea
            value={billNote}
            onChange={e => setBillNote(e.target.value)}
            placeholder="Add note to bill (optional)..."
            rows={2}
            style={{
              width: '100%',
              border: '1px solid #f3e8ff',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '13px',
              fontFamily: "'DM Sans', sans-serif",
              outline: 'none',
              color: '#1a0a2e',
              background: 'white',
              resize: 'none',
              marginTop: '8px',
              boxSizing: 'border-box'
            }}
          />
        </div>
        
        <div className="pos-right">
          <OrderSummary key={billKey} 
            {...pos}
            netAmount={pos.amountToPay}
            {...(editOf ? { editing: true, activeCreditNotes: [], availableCredit: 0, maxApplicableCredit: 0, creditNoteDiscount: 0, maxRedeemable: 0, loyaltyToRedeem: 0, customerDues: [], isSaving: savingEdit } : {})}
            cartLength={pos.cart.length}
            completeSale={handleCompleteSale}
            alterationQty={alterationQty}
            setAlterationQty={setAlterationQty}
            onViewHistory={(c) => setHistoryCustomer(c)}
          />
        </div>

        {historyCustomer && (
          <CustomerHistoryModal
            customer={historyCustomer}
            onClose={() => setHistoryCustomer(null)}
          />
        )}

        {showModal && completedSaleData && (
          <BillModal 
            saleData={completedSaleData}
            onClose={() => { setShowModal(false); setCompletedSaleData(null); }}
            onNewSale={() => { setShowModal(false); setCompletedSaleData(null); handleNewSale(); }}
          />
        )}

        {showAddModal && (
          <AddProductModal
            barcode={addProductBarcode}
            onClose={() => { setShowAddModal(false); setAddProductBarcode('') }}
            onAdded={product => editOf ? selectProduct(product) : pos.addToCart(product, true)}
          />
        )}

        {saveOpen && editOf && (
          <div style={S.overlay} onClick={() => !savingEdit && setSaveOpen(false)}>
            <div style={{ ...S.card, maxWidth: 460 }} onClick={e => e.stopPropagation()}>
              <div style={S.head}>
                <div>
                  <div style={S.title}>Save changes to {editOf.invoiceNo}</div>
                  <div style={S.sub}>New total ₹{pos.netAmount.toFixed(2)}{pos.creditRemainder > 0 ? ` · pending ₹${pos.creditRemainder.toFixed(2)}` : ''}</div>
                </div>
              </div>
              <div style={S.body}>
                <div style={S.section}>Why is this bill being edited?</div>
                <input style={{ ...S.input, width: '100%' }} autoFocus data-enter="own" value={editReason} placeholder="e.g. wrong size billed"
                  onChange={e => setEditReason(e.target.value)} onKeyDown={e => e.key === 'Enter' && !savingEdit && saveEdit()} />
                {(selectedSalesman?.id || '') !== editOf.salesmanId && (<>
                  <div style={{ ...S.section, marginTop: 10 }}>Admin password (the salesman was changed)</div>
                  <input style={{ ...S.input, width: '100%' }} type="password" data-enter="own" value={editPw}
                    onChange={e => setEditPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && !savingEdit && saveEdit()} />
                </>)}
                <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                  <button style={S.btnOutline} disabled={savingEdit} onClick={() => setSaveOpen(false)}>Back</button>
                  <button style={S.btnPrimary} disabled={savingEdit} onClick={saveEdit}>{savingEdit ? 'Saving…' : 'Save Changes'}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {pos.oldLotAlert && (
          <OldLotAlertModal
            scannedProduct={pos.oldLotAlert.scanned}
            olderProduct={pos.oldLotAlert.older}
            onSwap={pos.confirmUseOlderLot}
            onKeep={pos.confirmKeepScannedLot}
            onCancel={pos.dismissOldLotAlert}
          />
        )}
      </div>
    </Layout>
  );
}
