import { useState } from 'react'
import { X, Trash2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { clearPendingSale, getPendingSales } from '../../utils/offlineCache'
import { journalBill } from '../../utils/billJournal'
import { S } from './billEditStyles'

/**
 * Remove a bill that never reached the server (it only exists on this PC, waiting to be
 * sent). Same rule as deleting any bill: a reason and the admin password. Its stock was never
 * taken, so nothing needs putting back. A copy stays in the bill journal on disk.
 */
export function DeleteUnsentBillModal({ pendingId, billNo, onClose, onDeleted }: {
  pendingId: number; billNo: string; onClose: () => void; onDeleted: () => void
}) {
  const [reason, setReason] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (reason.trim().length < 3) { setError('Please give a reason'); return }
    if (!password) { setError('Enter the admin password'); return }
    setBusy(true); setError('')
    const { data, error: rpcErr } = await supabase.rpc('admin_password_ok', { p_password: password })
    if (rpcErr || data !== true) {
      setBusy(false)
      setError(rpcErr ? 'Could not check the password: ' + rpcErr.message : 'Admin password is wrong')
      return
    }
    const sale = getPendingSales().find((s: any) => s.pendingId === pendingId)
    if (sale) journalBill('deleted', sale, reason.trim())
    clearPendingSale(pendingId)
    setBusy(false)
    toast.success(`${billNo} removed`)
    onDeleted(); onClose()
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.card, maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div style={S.head}>
          <div>
            <div style={S.title}>Remove unsent bill {billNo}</div>
            <div style={S.sub}>This bill never reached the server, so nothing was taken from stock and nothing needs putting back.</div>
          </div>
          <button style={S.x} onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div style={S.body}>
          <div style={S.section}>Reason <span style={{ color: '#dc2626' }}>*</span></div>
          <input style={{ ...S.input, width: '100%' }} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. re-made as a new bill" autoFocus />
          <div style={S.section}>Admin password <span style={{ color: '#dc2626' }}>*</span></div>
          <input style={{ ...S.input, width: '100%' }} type="password" autoComplete="new-password" value={password}
            onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          {error && <div style={S.error}>{error}</div>}
        </div>
        <div style={S.foot}>
          <button style={S.btnOutline} onClick={onClose} disabled={busy}>Cancel</button>
          <button style={{ ...S.btnPrimary, background: '#dc2626' }} onClick={submit} disabled={busy}>
            {busy ? <Loader2 size={15} className="spinner" /> : <Trash2 size={15} style={{ verticalAlign: '-3px' }} />} Remove bill
          </button>
        </div>
      </div>
    </div>
  )
}
