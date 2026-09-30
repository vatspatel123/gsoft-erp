import type { BillDesign, LabelDesign } from './formatDesigns'

export const SETTINGS_KEY = 'erp_settings'

export interface AppSettings {
  // Shop Info
  shopName: string
  shopTagline: string
  ownerName: string
  shopAddress: string
  shopPhone: string
  shopEmail: string
  gstin: string
  state: string
  city: string
  pincode: string
  // Bill & Print
  billHeader: string
  billFooter: string
  billTerms: string          // one condition per line, printed under the total
  showPaymentBreakdown: boolean
  shopLogo: string           // data: URL, printed above the shop name ('' = none)
  billPrinter: string        // Windows device name for receipts ('' = ask each time)
  barcodePrinter: string     // Windows device name for barcode labels
  onlineLabelPrinter: string // Windows device name for online-order labels
  printWidthMm: number       // what the head can actually mark; 0 = work it out from paperSize
  a4Printer: string          // Windows device name for A4 documents ('' = ask each time)
  rawLabels: boolean         // send barcode labels as TSPL instead of rendering HTML
  // Label stock, measured off the roll in the shop. Rolls vary and no default
  // survives contact with real stationery, so every dimension is adjustable.
  labelWidthMm: number
  labelHeightMm: number
  labelColumns: number       // labels across the web
  labelColumnGapMm: number
  labelRowGapMm: number      // the gap the printer's sensor indexes on
  labelOffsetXmm: number     // nudge, for stock that sits off-centre
  labelOffsetYmm: number
  labelDarkness: number      // 0-15
  labelSpeed: number         // inches per second
  waServerUrl: string        // address of the WhatsApp relay ('' = never send directly)
  googleReviewUrl: string    // appended to the WhatsApp bill message ('' = omit)
  instagramUrl: string       // appended to the WhatsApp bill message ('' = omit)
  showGSTIN: boolean
  showCustomer: boolean
  showSalesman: boolean
  showGSTBreakdown: boolean
  showLoyaltyPoints: boolean
  showBarcode: boolean
  showUPIQR: boolean
  paperSize: '58mm' | '80mm' | 'A4'
  // Formats made in the designer. -1 = the built-in layout.
  billDesigns: BillDesign[]
  activeBillDesign: number
  labelDesigns: LabelDesign[]
  activeLabelDesign: number
  autoPrint: boolean
  autoWhatsApp: boolean
  // Notifications
  lowStockAlert: boolean
  lowStockThreshold: number
  birthdayReminders: boolean
  creditReminder: boolean
  creditReminderDays: number
  dailyTargetEnabled: boolean
  dailyTarget: number
  eodSummary: boolean
  eodTime: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  shopName: 'Retail ERP',
  shopTagline: 'Fashion Edition',
  ownerName: '',
  shopAddress: '',
  shopPhone: '',
  shopEmail: '',
  gstin: '',
  state: 'Gujarat',
  city: 'Ahmedabad',
  pincode: '',
  billHeader: 'Tax Invoice',
  billFooter: '!! Thank you for shopping !!',
  billTerms: 'EXCHANGE WITHIN 3 DAYS.\nNO REFUND.',
  showPaymentBreakdown: true,
  shopLogo: '',
  billPrinter: '',
  barcodePrinter: '',
  onlineLabelPrinter: '',
  printWidthMm: 0,
  a4Printer: '',
  rawLabels: true,
  labelWidthMm: 38,
  labelHeightMm: 38,
  labelColumns: 2,
  labelColumnGapMm: 2,
  labelRowGapMm: 2,
  labelOffsetXmm: 0,
  labelOffsetYmm: 0,
  labelDarkness: 8,
  labelSpeed: 4,
  waServerUrl: 'http://localhost:8099',
  googleReviewUrl: '',
  instagramUrl: '',
  showGSTIN: true,
  showCustomer: true,
  showSalesman: true,
  showGSTBreakdown: true,
  showLoyaltyPoints: true,
  showBarcode: false,
  showUPIQR: false,
  paperSize: '80mm',
  billDesigns: [],
  activeBillDesign: -1,
  labelDesigns: [],
  activeLabelDesign: -1,
  autoPrint: false,
  autoWhatsApp: false,
  lowStockAlert: true,
  lowStockThreshold: 10,
  birthdayReminders: true,
  creditReminder: true,
  creditReminderDays: 7,
  dailyTargetEnabled: false,
  dailyTarget: 0,
  eodSummary: false,
  eodTime: '20:00',
}

/**
 * Settings that belong to the MACHINE, not the shop.
 *
 * Printer device names differ on every computer, so syncing them would point the
 * shop PC at printers that only exist on someone else's desk. Everything else —
 * shop name, logo, bill conditions, footer, links — belongs to the shop and
 * follows the login onto any computer.
 */
const MACHINE_KEYS = [
  'billPrinter', 'barcodePrinter', 'onlineLabelPrinter', 'waServerUrl',
  'printWidthMm', 'a4Printer',
  'rawLabels', 'labelWidthMm', 'labelHeightMm', 'labelColumns', 'labelColumnGapMm',
  'labelRowGapMm', 'labelOffsetXmm', 'labelOffsetYmm', 'labelDarkness', 'labelSpeed',
] as const

const sharedOnly = (s: AppSettings): Partial<AppSettings> => {
  const out: any = { ...s }
  for (const k of MACHINE_KEYS) delete out[k]
  return out
}

/**
 * Load the shop's settings from the database over whatever this machine has.
 * Called once after sign-in. A fresh install therefore picks up the shop's bill
 * layout, logo and conditions instead of showing factory defaults.
 */
export async function pullShopSettings(): Promise<boolean> {
  try {
    const { supabase } = await import('../lib/supabase')
    const { data, error } = await supabase
      .from('stores').select('settings').order('created_at', { ascending: true }).limit(1)
    if (error) return false

    const local = getSettings()
    const remote = data?.[0]?.settings

    // Nothing stored yet. Seed it from this machine ONLY if this machine has
    // actually been configured — otherwise a fresh install would publish factory
    // defaults over the shop's real bill layout.
    if (!remote) {
      const configured = local.shopName && local.shopName !== DEFAULT_SETTINGS.shopName
      if (configured) await pushShopSettings()
      return false
    }
    const machine: any = {}
    for (const k of MACHINE_KEYS) machine[k] = local[k]

    // Merge, don't clobber. An empty value on the server must not wipe something
    // this machine has configured — otherwise seeding the shop's address would
    // also erase a logo that only exists here. (Consequence: clearing a field
    // shop-wide has to be done on each machine.)
    const merged: any = { ...DEFAULT_SETTINGS, ...local }
    for (const [k, v] of Object.entries(remote as Record<string, unknown>)) {
      if (v !== '' && v !== null && v !== undefined) merged[k] = v
    }
    for (const k of MACHINE_KEYS) merged[k] = (local as any)[k]

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged))
    return true
  } catch { return false }
}

/** Publish this shop's settings so other computers pick them up. */
export async function pushShopSettings(): Promise<boolean> {
  try {
    const { supabase } = await import('../lib/supabase')
    const { data } = await supabase
      .from('stores').select('id').order('created_at', { ascending: true }).limit(1)
    const id = data?.[0]?.id
    if (!id) return false
    const { error } = await supabase
      .from('stores').update({ settings: sharedOnly(getSettings()) }).eq('id', id)
    return !error
  } catch { return false }
}

export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {}
  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(patch: Partial<AppSettings>): void {
  const current = getSettings()
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...patch }))

  // Machine-only changes stay put; anything else is published for the shop's
  // other computers. Fire and forget so saving never blocks the screen.
  const touchesShared = Object.keys(patch).some(
    k => !(MACHINE_KEYS as readonly string[]).includes(k))
  if (touchesShared) void pushShopSettings()
}

// Paper width in mm — the physical stationery.
export function billWidthMm(paperSize?: string): number {
  return paperSize === '58mm' ? 58 : paperSize === 'A4' ? 190 : 80
}

/**
 * The width the print head can actually mark, which is NOT the paper width.
 * An 80mm thermal printer images 72mm (576 dots at 203 dpi) and a 58mm one
 * about 48mm. Laying a bill out to the paper width pushes its right-hand
 * column — the Amount, the end of the bill number — off the edge of the paper,
 * which is exactly what the shop photographed.
 *
 * Heads differ, so this is overridable. 0 means "work it out from paperSize".
 */
export function billPrintWidthMm(s?: AppSettings): number {
  const c = s || getSettings()
  const override = Number(c.printWidthMm) || 0
  if (override > 0) return override
  return c.paperSize === '58mm' ? 48 : c.paperSize === 'A4' ? 190 : 72
}
