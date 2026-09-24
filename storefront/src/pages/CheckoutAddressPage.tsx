import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartContext } from '../context/CartContext'

export interface AddressForm {
  name: string
  phone: string
  email: string
  address: string
  city: string
  state: string
  pincode: string
}

const fieldStyle: React.CSSProperties = {
  border: '1px solid rgba(51,59,71,.18)', borderRadius: 10, padding: '13px 14px',
  fontSize: 14.5, color: 'var(--navy)', background: 'var(--cream)'
}
const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, letterSpacing: '.1em',
  textTransform: 'uppercase', color: 'rgba(51,59,71,.55)'
}

export function CheckoutAddressPage() {
  const { lines } = useCartContext()
  const navigate = useNavigate()
  const [form, setForm] = useState<AddressForm>({ name: '', phone: '', email: '', address: '', city: '', state: 'Gujarat', pincode: '' })

  const set = (k: keyof AddressForm) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const canContinue = form.name && form.phone.length >= 10 && form.address && form.city && form.pincode.length >= 6

  if (lines.length === 0) {
    return <main className="container" style={{ padding: '70px 24px', textAlign: 'center' }}>Your bag is empty.</main>
  }

  return (
    <main className="container" style={{ padding: '30px 24px 70px', maxWidth: 1060 }}>
      <div style={{ background: '#fff', border: '1px solid rgba(51,59,71,.09)', borderRadius: 18, padding: 24, maxWidth: 620 }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 26, margin: '0 0 18px' }}>Delivery details</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
          <label style={labelStyle}>Full name<input style={fieldStyle} value={form.name} onChange={set('name')} placeholder="Ananya Sharma" /></label>
          <label style={labelStyle}>Mobile number<input style={fieldStyle} value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" /></label>
          <label style={{ ...labelStyle, gridColumn: '1/-1' }}>Address<input style={fieldStyle} value={form.address} onChange={set('address')} placeholder="Flat / House no, Street, Landmark" /></label>
          <label style={labelStyle}>Pincode<input style={fieldStyle} value={form.pincode} onChange={set('pincode')} placeholder="400052" /></label>
          <label style={labelStyle}>City<input style={fieldStyle} value={form.city} onChange={set('city')} placeholder="Mumbai" /></label>
          <label style={labelStyle}>State<input style={fieldStyle} value={form.state} onChange={set('state')} placeholder="Maharashtra" /></label>
          <label style={labelStyle}>Email (optional)<input style={fieldStyle} value={form.email} onChange={set('email')} placeholder="you@email.com" /></label>
        </div>
        <button
          type="button"
          disabled={!canContinue}
          onClick={() => navigate('/checkout/payment', { state: form })}
          className="btn-pill btn-primary"
          style={{ width: '100%', marginTop: 22, minHeight: 54, justifyContent: 'center', opacity: canContinue ? 1 : .5, cursor: canContinue ? 'pointer' : 'not-allowed' }}
        >Continue to payment</button>
      </div>
    </main>
  )
}
