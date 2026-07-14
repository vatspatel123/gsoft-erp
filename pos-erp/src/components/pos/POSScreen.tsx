import { usePOS } from '../../hooks/usePOS'
import { ProductSearch } from './ProductSearch'
import { Cart } from './Cart'
import { OrderSummary } from './OrderSummary'
import { Monitor, Zap } from 'lucide-react'

// ── These would come from your auth context in a real app ──
const DEMO_COUNTER_ID = 'counter-001'
const DEMO_SALESMAN_ID = 'user-001'
const DEMO_COUNTER_NAME = 'Counter 1'

export function POSScreen() {
  const pos = usePOS(DEMO_COUNTER_ID, DEMO_SALESMAN_ID)

  return (
    <div className="pos-screen">

      {/* ── TOP BAR ── */}
      <div className="pos-topbar">
        <div className="pos-brand">
          <Zap size={18} className="brand-icon" />
          <span>GSOFT ERP</span>
          <span className="pos-divider">|</span>
          <span className="pos-module">Point of Sales</span>
        </div>
        <div className="pos-counter-badge">
          <Monitor size={14} />
          <span>{DEMO_COUNTER_NAME}</span>
        </div>
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div className="pos-body">

        {/* ── LEFT: SEARCH + CART ── */}
        <div className="pos-left">
          <div className="pos-search-wrapper">
            <ProductSearch onSelect={pos.addToCart} />
          </div>
          <div className="pos-cart-wrapper">
            <div className="cart-header">
              <h2 className="cart-title">
                Cart
                {pos.cart.length > 0 && (
                  <span className="cart-count-badge">{pos.cart.length}</span>
                )}
              </h2>
            </div>
            <Cart
              cart={pos.cart}
              onUpdateQty={pos.updateQty}
              onUpdateDiscount={pos.updateDiscount}
              onRemove={pos.removeFromCart}
            />
          </div>
        </div>

        {/* ── RIGHT: ORDER SUMMARY ── */}
        <div className="pos-right">
          <OrderSummary
            customer={pos.customer}
            onSearchCustomer={pos.searchCustomer}

            coupon={pos.coupon}
            couponCode={pos.couponCode}
            onCouponCodeChange={pos.setCouponCode}
            onApplyCoupon={pos.applyCoupon}
            onRemoveCoupon={pos.removeCoupon}

            loyaltyPointsToRedeem={pos.loyaltyPointsToRedeem}
            maxRedeemablePoints={pos.maxRedeemablePoints}
            onLoyaltyChange={pos.setLoyaltyPointsToRedeem}

            paymentMode={pos.paymentMode}
            onPaymentModeChange={pos.setPaymentMode}

            subtotal={pos.subtotal}
            gstAmount={pos.gstAmount}
            couponDiscount={pos.couponDiscount}
            loyaltyDiscount={pos.loyaltyDiscount}
            netAmount={pos.netAmount}
            cartCount={pos.cart.length}

            onCompleteSale={pos.completeSale}
            onClearCart={pos.clearCart}
            isSaving={pos.isSaving}
            lastInvoice={pos.lastInvoice}
          />
        </div>
      </div>
    </div>
  )
}
