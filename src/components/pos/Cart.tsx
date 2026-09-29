import { ShoppingBag, X, Tag } from 'lucide-react';
import type { CartItem } from '../../hooks/usePOS';

interface CartProps {
  items: CartItem[];
  onUpdateQty: (id: string, qty: number) => void;
  onUpdateDiscount: (id: string, pct: number) => void;
  onRemove: (id: string) => void;
}

export function Cart({ items, onUpdateQty, onUpdateDiscount, onRemove }: CartProps) {
  if (items.length === 0) {
    return (
      <div className="cart-empty">
        <ShoppingBag size={40} color="#c084fc" />
        <h3>Cart is empty</h3>
        <p>Search or scan a product to add</p>
      </div>
    );
  }

  return (
    <div className="cart-list">
      {/* Piece count, so the cashier can match it against the pile on the counter. */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 16px', borderRadius: '12px', background: '#f3e8ff',
        color: '#6b21a8', fontSize: '14px', fontWeight: 600, marginBottom: '10px',
      }}>
        <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
        <span>Total Qty: <b style={{ fontSize: '18px', fontFamily: 'DM Mono, monospace' }}>
          {items.reduce((s, i) => s + i.qty, 0)}</b> pcs</span>
      </div>
      {items.map((item, idx) => {
        const p = item.product as any;
        const fashionParts = [
          p.design_no ? `D:${p.design_no}` : null,
          p.size || null,
          p.colour || null,
        ].filter(Boolean);

        return (
          <div key={item.product.id} className="cart-item">
            <div className="top-row">
              <div className="item-info">
                <div className="item-num">{idx + 1}</div>
                <div>
                  <div className="item-name">{item.product.name}</div>
                  {fashionParts.length > 0 && (
                    <div style={{ fontSize: '10px', color: '#9333ea', marginTop: '1px', fontWeight: 500 }}>
                      {fashionParts.join(' · ')}
                    </div>
                  )}
                </div>
              </div>
              <button className="delete-btn" onClick={() => onRemove(item.product.id)}>
                <X size={18} />
              </button>
            </div>
            <div className="bottom-row">
              <div className="qty-control">
                <button onClick={() => onUpdateQty(item.product.id, item.qty - 1)}>−</button>
                <input
                  type="number"
                  value={item.qty}
                  onChange={e => onUpdateQty(item.product.id, parseInt(e.target.value) || 0)}
                />
                <button onClick={() => onUpdateQty(item.product.id, item.qty + 1)}>+</button>
              </div>

              <div className="discount-input">
                <Tag />
                <input
                  type="number"
                  value={item.discount_pct}
                  onChange={e => onUpdateDiscount(item.product.id, parseFloat(e.target.value) || 0)}
                />
                <span>%</span>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div className="line-total">₹{item.line_total.toFixed(2)}</div>
                {item.discount_pct > 0 && (
                  <div className="savings-badge">
                    You save ₹{((item.qty * item.unit_price) - item.line_total).toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
