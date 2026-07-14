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
  showGSTIN: boolean
  showCustomer: boolean
  showSalesman: boolean
  showGSTBreakdown: boolean
  showLoyaltyPoints: boolean
  showBarcode: boolean
  showUPIQR: boolean
  paperSize: '58mm' | '80mm' | 'A4'
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
  billFooter: 'Thank you for shopping!',
  showGSTIN: true,
  showCustomer: true,
  showSalesman: true,
  showGSTBreakdown: true,
  showLoyaltyPoints: true,
  showBarcode: false,
  showUPIQR: false,
  paperSize: '80mm',
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
}
