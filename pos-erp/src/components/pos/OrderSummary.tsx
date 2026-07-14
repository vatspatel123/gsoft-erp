import { useState } from 'react'
import type { Customer, Coupon, PaymentMode } from '../../types'
import { User, Phone, Tag, Star, CreditCard, Banknote, Smartphone, BookOpen, CheckCircle, RefreshCw } from 'lucide-react'

interface Props {
  customer: Customer | null
  onSearchCustomer: (phone: string) => void

  coupon: Coupon | null
  couponCode: string
  onCouponCodeChange: (v: string) => void
  onApplyCoupon: () => void
  onRemoveCoupon: () => void

  loyaltyPointsToRedeem: number
  maxRedeemablePoints: number
  onLoyaltyChange: (pts: number) => void

  paymentMode: PaymentMode
  onPaymentModeChange: (mode: PaymentMode) => void

  subtotal: number
  gstAmount: number
  couponDiscount: number
  loyaltyDiscount: number
  netAmount: number
  cartCount: number

  onCompleteSale: () => void
  onClearCart: () => void
  isSaving: boolean
  lastInvoice: string | null
}

const PAYMENT_MODES: { mode: PaymentMode; label: string; Icon: any }[] = [
  { mode: 'cash',   label: 'Cash',   Icon: Banknote },
  { mode: 'card',   label: 'Card',   Icon: CreditCard },
  { mode: 'upi',    label: 'UPI',    Icon: Smartphone },
  { mode: 'credit', label: 'Credit', Icon: BookOpen },
]

export function OrderSummary({
  customer, onSearchCustomer,
  coupon, couponCode, onCouponCodeChange, onApplyCoupon, onRemoveCoupon,
  loyaltyPointsToRedeem, maxRedeemablePoints, onLoyaltyChange,
  paymentMode, onPaymentModeChange,
  subtotal, gstAmount, couponDiscount, loyaltyDiscount, netAmount, cartCount,
  onCompleteSale, onClearCart, isSaving, lastInvoice
}: Props) {
  const [phoneQuery, setPhoneQuery] = useState('')

  const handlePhoneSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSearchCustomer(phoneQuery)
  }

  return (
    <div className="order-summary">

      {/* ── CUSTOMER ── */}
      <div className="summary-section">
        <h3 className="section-title"><User size={14} /> Customer</h3>
        {customer ? (
          <div className="customer-card">
            <div className="customer-avatar">{customer.name.charAt(0)}</div>
            <div className="customer-info">
              <p className="customer-name">{customer.name}</p>
              <p className="customer-phone">{customer.phone}</p>
            </div>
            <div className="customer-pts">
              <Star size={12} className="star-icon" />
              <span>{customer.loyalty_points} pts</span>
            </div>
          </div>
        ) : (
          <div className="customer-search">
            <Phone size={14} className="input-icon" />
            <input
              type="tel"
              placeholder="Phone number + Enter"
              value={phoneQuery}
              onChange={e => setPhoneQuery(e.target.value)}
              onKeyDown={handlePhoneSearch}
              className="inline-input"
            />
          </div>
        )}
      </div>

      {/* ── COUPON ── */}
      <div className="summary-section">
        <h3 className="section-title"><Tag size={14} /> Coupon</h3>
        {coupon ? (
          <div className="coupon-applied">
            <CheckCircle size={14} className="check-icon" />
            <span>{coupon.code}</span>
            <span className="coupon-save">–₹{couponDiscount.toFixed(2)}</span>
            <button onClick={onRemoveCoupon} className="remove-coupon">✕</button>
          </div>
        ) : (
          <div className="coupon-input-row">
            <input
              type="text"
              placeholder="Enter coupon code"
              value={couponCode}
              onChange={e => onCouponCodeChange(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && onApplyCoupon()}
              className="inline-input"
            />
            <button onClick={onApplyCoupon} className="apply-btn">Apply</button>
          </div>
        )}
      </div>

      {/* ── LOYALTY POINTS ── */}
      {customer && customer.loyalty_points > 0 && (
        <div className="summary-section">
          <h3 className="section-title"><Star size={14} /> Loyalty Points</h3>
          <div className="loyalty-row">
            <span className="loyalty-avail">Available: {customer.loyalty_points} pts</span>
            <span className="loyalty-value">(₹{(customer.loyalty_points * 0.25).toFixed(2)})</span>
          </div>
          <div className="loyalty-slider-row">
            <input
              type="range"
              min={0}
              max={maxRedeemablePoints}
              value={loyaltyPointsToRedeem}
              onChange={e => onLoyaltyChange(parseInt(e.target.value))}
              className="loyalty-slider"
            />
            <span className="loyalty-redeem-val">
              {loyaltyPointsToRedeem > 0 ? `–₹${loyaltyDiscount.toFixed(2)}` : 'Not using'}
            </span>
          </div>
        </div>
      )}

      {/* ── PAYMENT MODE ── */}
      <div className="summary-section">
        <h3 className="section-title"><CreditCard size={14} /> Payment</h3>
        <div className="payment-grid">
          {PAYMENT_MODES.map(({ mode, label, Icon }) => (
            <button
              key={mode}
              className={`payment-btn ${paymentMode === mode ? 'active' : ''}`}
              onClick={() => onPaymentModeChange(mode)}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── TOTALS ── */}
      <div className="totals-section">
        <div className="total-row">
          <span>Subtotal ({cartCount} items)</span>
          <span>₹{subtotal.toFixed(2)}</span>
        </div>
        <div className="total-row">
          <span>GST</span>
          <span>₹{gstAmount.toFixed(2)}</span>
        </div>
        {couponDiscount > 0 && (
          <div className="total-row discount">
            <span>Coupon Discount</span>
            <span>–₹{couponDiscount.toFixed(2)}</span>
          </div>
        )}
        {loyaltyDiscount > 0 && (
          <div className="total-row discount">
            <span>Loyalty Discount</span>
            <span>–₹{loyaltyDiscount.toFixed(2)}</span>
          </div>
        )}
        <div className="total-row net">
          <span>Net Payable</span>
          <span>₹{netAmount.toFixed(2)}</span>
        </div>
      </div>

      {/* ── LAST INVOICE ── */}
      {lastInvoice && (
        <div className="last-invoice-badge">
          <CheckCircle size={14} /> Last: {lastInvoice}
        </div>
      )}

      {/* ── ACTIONS ── */}
      <div className="summary-actions">
        <button
          className="btn-complete"
          onClick={onCompleteSale}
          disabled={cartCount === 0 || isSaving}
        >
          {isSaving ? (
            <><div className="btn-spinner" /> Processing…</>
          ) : (
            <>Complete Sale · ₹{netAmount.toFixed(2)}</>
          )}
        </button>
        <button className="btn-clear" onClick={onClearCart}>
          <RefreshCw size={14} /> New Sale
        </button>
      </div>
    </div>
  )
}
