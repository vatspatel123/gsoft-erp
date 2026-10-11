import { useState } from 'react'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { S } from '../bills/billEditStyles'
import { STATE_CODES } from '../../utils/ewayBill'

const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

/**
 * Add or edit a wholesale party. Blank boxes are saved as "none", not "" (an
 * empty string in a number or unique column is what broke the customer edit).
 * Bills already made keep the details they were printed with; the party's new
 * details are used from the next bill on.
 */
export function PartyFormModal({ party, onClose, onSaved }: { party?: any; onClose: () => void; onSaved: (p: any) => void }) {
  const [f, setF] = useState(() => ({
    name: party?.name || '', business_name: party?.business_name || '', phone: party?.phone || '', email: party?.email || '',
    gstin: party?.gstin || '', address: party?.address || '', city: party?.city || '', state: party?.state || 'Gujarat',
    pincode: party?.pincode || '', credit_limit: party?.credit_limit != null ? String(party.credit_limit) : '',
    is_active: party?.is_active !== false,
  }))
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof f, v: any) => setF(p => ({ ...p, [k]: v }))

  const save = async () => {
    const phone = f.phone.replace(/\D/g, '')
    const gstin = f.gstin.trim().toUpperCase()
    if (!f.name.trim()) { toast.error('Party name is required'); return }
    if (phone && phone.length !== 10) { toast.error('Phone must be 10 digits'); return }
    if (gstin && !GSTIN_RE.test(gstin)) { toast.error('GSTIN looks wrong — it should be 15 characters, like 24ABCDE1234F1Z5'); return }
    if (f.pincode.trim() && !/^\d{6}$/.test(f.pincode.trim())) { toast.error('PIN code must be 6 digits'); return }
    if (f.credit_limit.trim() && !(Number(f.credit_limit) >= 0)) { toast.error('Credit limit must be a number'); return }

    const row = {
      name: f.name.trim(), business_name: f.business_name.trim() || null, phone: phone || null, email: f.email.trim() || null,
      gstin: gstin || null, address: f.address.trim() || null, city: f.city.trim() || null, state: f.state || null,
      pincode: f.pincode.trim() || null, credit_limit: f.credit_limit.trim() ? Number(f.credit_limit) : null, is_active: f.is_active,
    }
    setSaving(true)
    const { data, error } = party
      ? await supabase.from('wholesale_customers').update(row).eq('id', party.id).select().single()
      : await supabase.from('wholesale_customers').insert(row).select().single()
    setSaving(false)
    if (error || !data) { toast.error('Party not saved: ' + (error?.message || 'no answer from the server')); return }
    toast.success(party ? 'Party updated' : 'Party added')
    onSaved(data)
    onClose()
  }

  const box = (label: string, k: keyof typeof f, extra: any = {}) => (
    <label style={{ display: 'block' }}>
      <div style={{ ...S.muted, marginTop: 0, marginBottom: 4 }}>{label}</div>
      <input style={{ ...S.input, width: '100%' }} value={f[k] as string} onChange={e => set(k, e.target.value)} {...extra} />
    </label>
  )

  return (
    <div style={{ ...S.overlay, zIndex: 1100 }} onClick={onClose}>
      <div style={{ ...S.card, maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div style={S.head}>
          <div>
            <div style={S.title}>{party ? `Edit ${party.business_name || party.name}` : 'New wholesale party'}</div>
            <div style={S.sub}>Bills already made keep the details they were printed with; new bills use these.</div>
          </div>
          <button style={S.x} onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div style={{ ...S.body, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {box('Contact name *', 'name', { autoFocus: true })}
          {box('Business name (printed on the bill)', 'business_name')}
          {box('Phone (WhatsApp)', 'phone', { inputMode: 'numeric', placeholder: '10 digits' })}
          {box('GSTIN', 'gstin', { placeholder: '24ABCDE1234F1Z5', style: { ...S.input, width: '100%', textTransform: 'uppercase' } })}
          <div style={{ gridColumn: '1 / -1' }}>{box('Address', 'address')}</div>
          {box('City', 'city')}
          <label style={{ display: 'block' }}>
            <div style={{ ...S.muted, marginTop: 0, marginBottom: 4 }}>State</div>
            <select style={{ ...S.input, width: '100%' }} value={f.state} onChange={e => set('state', e.target.value)}>
              {!Object.keys(STATE_CODES).includes(f.state) && f.state && <option value={f.state}>{f.state}</option>}
              {Object.keys(STATE_CODES).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          {box('PIN code', 'pincode', { inputMode: 'numeric', placeholder: '6 digits' })}
          {box('Email', 'email', { type: 'email' })}
          {box('Credit limit ₹', 'credit_limit', { inputMode: 'decimal', placeholder: 'none' })}
          <label style={{ ...S.row, alignSelf: 'end', fontSize: 13 }}>
            <input type="checkbox" checked={f.is_active} onChange={e => set('is_active', e.target.checked)} /> Active (shown when billing)
          </label>
        </div>
        <div style={S.foot}>
          <button style={S.btnOutline} onClick={onClose} disabled={saving}>Cancel</button>
          <button data-enter-submit style={S.btnPrimary} onClick={save} disabled={saving}>{saving ? 'Saving…' : party ? 'Save changes' : 'Add party'}</button>
        </div>
      </div>
    </div>
  )
}
