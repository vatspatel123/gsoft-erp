import { useState, useEffect } from 'react';
import { Layout } from '../shared/Layout';
import { usePOS } from '../../hooks/usePOS';
import { RoleBadge, getRoleStyle } from '../shared/RoleBadge';
import { ProductSearch } from './ProductSearch';
import { Cart } from './Cart';
import { OrderSummary } from './OrderSummary';
import { BillModal } from './BillModal';
import { AddProductModal } from './AddProductModal';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import '../../styles/pos.css';

export default function POSScreen() {
  const [salesmen, setSalesmen] = useState<any[]>([]);
  const [selectedSalesman, setSelectedSalesman] = useState<any>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    const fetchSalesmen = async () => {
      if (navigator.onLine) {
        const { data } = await supabase
          .from('users')
          .select('id, name, role')
          .eq('is_active', true)
          .order('name')
        if (data && data.length > 0) {
          setSalesmen(data)
          localStorage.setItem(
            'gsoft_salesmen_cache',
            JSON.stringify({
              data: data,
              savedAt: Date.now()
            })
          )
        }
      } else {
        try {
          const raw = localStorage.getItem(
            'gsoft_salesmen_cache'
          )
          if (raw) {
            const parsed = JSON.parse(raw)
            setSalesmen(parsed.data || [])
          } else {
            toast.error(
              'No cached salesmen. ' +
              'Open app once with internet.'
            )
          }
        } catch(e) {
          console.error('Salesman cache error:', e)
        }
      }
    }
    fetchSalesmen()
  }, []);

  const pos = usePOS(selectedSalesman?.id || null);
  const [showModal, setShowModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addProductBarcode, setAddProductBarcode] = useState('');
  const [billNote, setBillNote] = useState('');

  const handleCompleteSale = async () => {
    const saleData = await pos.completeSale();
    if (saleData) {
      if (billNote.trim()) saleData.note = billNote.trim();
      setShowModal(true);
    }
  };

  const handleNewSale = () => {
    pos.clearCart()
    setBillNote('')
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
              <option value="">Select salesman...</option>
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
                <ProductSearch 
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
          <OrderSummary 
            {...pos}
            cartLength={pos.cart.length}
            completeSale={handleCompleteSale}
          />
        </div>

        {showModal && pos.lastSale && (
          <BillModal 
            saleData={pos.lastSale}
            onClose={() => setShowModal(false)}
            onNewSale={handleNewSale}
          />
        )}

        {showAddModal && (
          <div className="bill-modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="bill-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-30px', position: 'relative', zIndex: 10 }}>
                <button onClick={() => {
                  setShowAddModal(false)
                  setAddProductBarcode('')
                }} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}>×</button>
              </div>
              <AddProductModal 
                barcode={addProductBarcode}
                onClose={() => {
                  setShowAddModal(false)
                  setAddProductBarcode('')
                }}
              />
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
