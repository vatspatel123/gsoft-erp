import { Routes, Route } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { PlpPage } from './pages/PlpPage'
import { PdpPage } from './pages/PdpPage'
import { CartPage } from './pages/CartPage'
import { CheckoutAddressPage } from './pages/CheckoutAddressPage'
import { CheckoutPaymentPage } from './pages/CheckoutPaymentPage'
import { OrderSuccessPage } from './pages/OrderSuccessPage'
import { OrderTrackPage } from './pages/OrderTrackPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/shop" element={<PlpPage />} />
      <Route path="/product/:familyId" element={<PdpPage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/checkout" element={<CheckoutAddressPage />} />
      <Route path="/checkout/payment" element={<CheckoutPaymentPage />} />
      <Route path="/order/success" element={<OrderSuccessPage />} />
      <Route path="/order/track" element={<OrderTrackPage />} />
    </Routes>
  )
}
