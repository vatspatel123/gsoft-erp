import type { CartItem } from '../../types'
import { Trash2, Plus, Minus, Tag } from 'lucide-react'

interface Props {
  cart: CartItem[]
  onUpdateQty: (productId: string, qty: number) => void
  onUpdateDiscount: (productId: string, discount: number) => void
  onRemove: (productId: string) => void
}

export function Cart({ cart, onUpdateQty, onUpdateDiscount, onRemove }: Props) {
  if (cart.length === 0) {
    return (
      <div className="cart-empty">
        <div className="cart-empty-icon">🛒</div>
        <p>Cart is empty</p>
        <span>Search or scan a product to begin</span>
      </div>
    )
  }

  return (
    <div className="cart-list">
      {cart.map((item, idx) => (
        <div key={item.product.id} className="cart-item" style={{ animationDelay: `${idx * 0.04}s` }}>
          <div className="cart-item-header">
            <div className="cart-item-name-wrap">
              <span className="cart-item-idx">{idx + 1}</span>
              <div>
                <p className="cart-item-name">{item.product.name}</p>
                <p className="cart-item-sku">{item.product.sku} · GST {item.product.gst_rate}%</p>
              </div>
            </div>
            <button className="cart-remove-btn" onClick={() => onRemove(item.product.id)}>
              <Trash2 size={14} />
            </button>
          </div>

          <div className="cart-item-controls">
            {/* Quantity */}
            <div className="qty-control">
              <button
                className="qty-btn"
                onClick={() => onUpdateQty(item.product.id, item.qty - 1)}
              >
                <Minus size={12} />
              </button>
              <input
                type="number"
                min={1}
                max={item.product.stock_qty}
                value={item.qty}
                onChange={e => onUpdateQty(item.product.id, parseInt(e.target.value) || 1)}
                className="qty-input"
              />
              <button
                className="qty-btn"
                onClick={() => onUpdateQty(item.product.id, item.qty + 1)}
                disabled={item.qty >= item.product.stock_qty}
              >
                <Plus size={12} />
              </button>
            </div>

            {/* Unit price */}
            <div className="cart-unit-price">
              <span className="label">Unit</span>
              <span>₹{item.unit_price.toFixed(2)}</span>
            </div>

            {/* Discount */}
            <div className="discount-control">
              <Tag size={11} />
              <input
                type="number"
                min={0}
                max={100}
                value={item.discount_pct}
                onChange={e => onUpdateDiscount(item.product.id, parseFloat(e.target.value) || 0)}
                className="discount-input"
              />
              <span>%</span>
            </div>

            {/* Line total */}
            <div className="cart-line-total">
              ₹{item.line_total.toFixed(2)}
            </div>
          </div>

          {item.discount_pct > 0 && (
            <div className="cart-item-savings">
              You save ₹{((item.unit_price * item.qty) - item.line_total).toFixed(2)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
