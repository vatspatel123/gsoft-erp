// Invoice numbers on this PC. The last INV-number used is remembered here so a bill made
// without internet gets the next normal number (INV-0233), not a temporary one, and an
// online bill made later can never take a number that is still waiting to be sent.
const KEY = 'gsoft_last_inv'
const pad = (n: number) => `INV-${String(n).padStart(4, '0')}`

export const lastInvoiceNo = (): number => { try { return Number(localStorage.getItem(KEY)) || 0 } catch { return 0 } }
export const rememberInvoiceNo = (n: number) => { try { if (n > lastInvoiceNo()) localStorage.setItem(KEY, String(n)) } catch { /* nothing kept */ } }
export const invoiceNoOf = pad

/** Next number with no internet. Falls back to a temporary INV-L number only if this PC has never seen a real one. */
export const offlineInvoiceNo = (): string => {
  const last = lastInvoiceNo()
  if (!last) return 'INV-L' + String(Date.now()).slice(-6)
  rememberInvoiceNo(last + 1)
  return pad(last + 1)
}
