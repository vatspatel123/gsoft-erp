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
import { saveProductsToCache, getCachedSalesmen, saveSalesmenToCache } from '../../utils/offlineCache';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import '../../styles/pos.css';

export default function POSScreen() {
  const [salesmen, setSalesmen] = useState<any[]>([]);
  const [selectedSalesman, setSelectedSalesman] = useState<any>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<any>(null);

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
    }
    fetchSalesmen()
  }, [])

  const pos = usePOS(selectedSalesman?.id || null);
  const [showModal, setShowModal] = useState(false);
  const [completedSaleData, setCompletedSaleData] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addProductBarcode, setAddProductBarcode] = useState('');
  const [billNote, setBillNote] = useState('');
  // Bumped after every bill: the search box and payment panel start over blank,
  // and so does the salesman — the next bill is a new sale, not a copy of the last.
  const [billKey, setBillKey] = useState(0);
  const startFresh = () => {
    pos.clearCart();
    setBillNote('');
    setSelectedSalesman(null);
    setBillKey(k => k + 1);
  };

  const handleCompleteSale = async () => {
    if (!selectedSalesman) {
      toast.error('⚠️ Please select a salesperson before completing the sale', { duration: 3000 });
      return;
    }
    const saleData = await pos.completeSale();
    if (saleData) {
      if (billNote.trim()) saleData.note = billNote.trim();
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
                  onSelect={pos.addToCart}
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
            cartLength={pos.cart.length}
            completeSale={handleCompleteSale}
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
            onAdded={product => pos.addToCart(product, true)}
          />
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
