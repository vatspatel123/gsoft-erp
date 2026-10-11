import { supabase } from '../lib/supabase'

/**
 * Daily backup of the shop's data to this PC (desktop app only). The data is read
 * with the signed-in login, then electron/backup.js writes and checks the file.
 * Left out on purpose: admin_secrets and staff_credentials (password material).
 */
const TABLES = [
  'products', 'categories', 'customers', 'suppliers', 'users', 'stores', 'counters', 'coupons', 'promo_offers',
  'sales', 'sale_items', 'credit_notes', 'exchange_bills', 'exchange_new_items', 'exchange_return_items',
  'purchase_bills', 'purchase_items', 'purchase_orders', 'purchase_order_items', 'purchase_returns', 'purchase_return_items',
  'inward_challans', 'inward_challan_items', 'wholesale_customers', 'wholesale_sales', 'wholesale_sale_items',
  'expenses', 'bill_edits', 'loyalty_transactions', 'stock_damage_log', 'physical_stock_counts',
  'gst_entries', 'ledger_entries', 'chart_of_accounts', 'online_orders', 'website_settings',
]
const ROW_LIMIT = 50000            // the server's own cap per request
const EVERY_MS = 11 * 60 * 60 * 1000   // a new backup when the newest is older than this: about twice a day

let running = false

export type BackupResult = { ok: boolean; name?: string; size?: number; problems: string[]; reason?: string }

/** Back up now. A table that cannot be read is listed in `problems`; the rest are still saved. */
export async function runBackup(reason: 'auto' | 'manual' = 'manual'): Promise<BackupResult> {
  const api = window.electronAPI?.backup
  if (!api) return { ok: false, problems: [], reason: 'Backups are made by the desktop app' }
  if (running) return { ok: false, problems: [], reason: 'A backup is already running' }
  if (!navigator.onLine) return { ok: false, problems: [], reason: 'No internet — try again when it is back' }
  running = true
  try {
    const tables: Record<string, unknown[]> = {}
    const problems: string[] = []
    for (let i = 0; i < TABLES.length; i += 6) {            // a few at a time: quick, and easy on the server
      await Promise.all(TABLES.slice(i, i + 6).map(async t => {
        const { data, error } = await supabase.from(t).select('*').limit(ROW_LIMIT)
        if (error) problems.push(`${t}: ${error.message}`)
        else {
          tables[t] = data || []
          if ((data?.length || 0) >= ROW_LIMIT) problems.push(`${t}: more than ${ROW_LIMIT} rows, only the first were saved`)
        }
      }))
    }
    // Nothing read at all (signed out, no access): no file, rather than an empty one that looks fine.
    if (!Object.values(tables).some(rows => rows.length)) {
      return { ok: false, problems, reason: problems[0] || 'No data could be read' }
    }
    const res = await api.write({ tables, meta: { createdAt: new Date().toISOString(), reason, problems } })
    return { ok: !!res.ok, name: res.name, size: res.size, problems, reason: res.reason }
  } catch (e: any) {
    return { ok: false, problems: [], reason: e?.message || 'Backup failed' }
  } finally { running = false }
}

/** Back up if the newest backup on this PC is older than about half a day. */
export async function backupIfDue(): Promise<void> {
  const api = window.electronAPI?.backup
  if (!api) return
  try {
    const { files } = await api.list()
    if (files[0] && Date.now() - files[0].at < EVERY_MS) return
    const r = await runBackup('auto')
    if (!r.ok) console.warn('Automatic backup did not run:', r.reason)
  } catch (e) { console.warn('Backup check failed:', e) }
}
