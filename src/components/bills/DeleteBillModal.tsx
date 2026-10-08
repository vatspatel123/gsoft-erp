import { useState } from 'react'
import { X, Trash2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { deleteBill } from '../../utils/billEdits'
import { S } from './billEditStyles'

/** Confirm deleting a sales or purchase bill with the admin password. */
export function DeleteBillModal({ type, billId, billNo, onClose, onDeleted }: {
  type: 'sale' | 'purchase'; billId: string; billNo: string; onClose: () => void; onDeleted: () => void
}) {
  const [reason, setReason] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (reason.trim().length < 3) { setError('Please give a reason'); return }
    if (!password) { setError('Enter the admin password'); return }
    setBusy(true); setError('')
    const res = await deleteBill(type, billId, reason.trim(), password)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    toast.success(`${billNo} deleted — stock put back`)
    onDeleted(); onClose()
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.card, maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div style={S.head}>
          <div>
            <div style={S.title}>Delete {type === 'sale' ? 'bill' : 'purchase'} {billNo}?</div>
            <div style={S.sub}>
              {type === 'sale'
                ? 'The pieces go back into stock and the customer’s points and spend are reversed.'
                : 'The pieces this bill brought in come back out of stock.'} A copy is kept in the history.
            </div>
          </div>
          <button style={S.x} onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div style={S.body}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: '#64748b' }}>
            Reason
            <input style={S.input} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Entered twice by mistake" autoFocus />
          </label>
          <div style={S.authBox}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>Admin password</div>
            <input style={{ ...S.input, width: '100%' }} type="password" placeholder="Admin password" autoComplete="new-password"
              data-enter="own" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>
          {error && <div style={S.error}>{error}</div>}
        </div>
        <div style={S.foot}>
          <button style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }} onClick={onClose}>Cancel</button>
          <button data-enter-submit disabled={busy} onClick={submit} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: '#dc2626',
            color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
            {busy ? <Loader2 size={15} className="spinner" /> : <Trash2 size={15} />} Delete bill
          </button>
        </div>
      </div>
    </div>
  )
}
