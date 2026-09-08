export type CustomerTier = 'New' | 'Regular' | 'VIP' | 'VVIP'

export interface CustomerTierInfo {
  tier: CustomerTier
  label: string
  badgeBg: string
  badgeText: string
  borderColor: string
  icon: string
  description: string
  tagline: string
}

export interface CustomerSalesSummary {
  billsCount: number
  maxSingleBill: number
  yearlySpent: number
  lifetimeSpent: number
}

/**
 * Calculates customer category/tier according to client business rules:
 * - VVIP: Single bill >= ₹60,000 OR Yearly spend >= ₹80,000
 * - VIP: Single bill >= ₹40,000 OR Yearly spend >= ₹60,000
 * - Regular: 3+ purchases (visits)
 * - New: 1–2 purchases (visits)
 */
export function calculateCustomerTier(summary: CustomerSalesSummary): CustomerTier {
  const { billsCount, maxSingleBill, yearlySpent, lifetimeSpent } = summary

  // Effective spent in year (fallback to lifetime if year not segregated)
  const spentInYear = yearlySpent > 0 ? yearlySpent : lifetimeSpent

  if (maxSingleBill >= 60000 || spentInYear >= 80000) {
    return 'VVIP'
  }

  if (maxSingleBill >= 40000 || spentInYear >= 60000) {
    return 'VIP'
  }

  if (billsCount >= 3) {
    return 'Regular'
  }

  return 'New'
}

export const TIER_CONFIG: Record<CustomerTier, CustomerTierInfo> = {
  VVIP: {
    tier: 'VVIP',
    label: 'VVIP Member',
    badgeBg: 'linear-gradient(135deg, #fef08a 0%, #fde047 50%, #eab308 100%)',
    badgeText: '#713f12',
    borderColor: '#eab308',
    icon: '👑',
    description: '₹60k+ Single Bill or ₹80k+/yr',
    tagline: 'Elite Royal Customer'
  },
  VIP: {
    tier: 'VIP',
    label: 'VIP Customer',
    badgeBg: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)',
    badgeText: '#6b21a8',
    borderColor: '#c084fc',
    icon: '💎',
    description: '₹40k+ Single Bill or ₹60k+/yr',
    tagline: 'High-Value Shopper'
  },
  Regular: {
    tier: 'Regular',
    label: 'Regular',
    badgeBg: '#eff6ff',
    badgeText: '#1e40af',
    borderColor: '#93c5fd',
    icon: '⭐',
    description: '3+ Purchases',
    tagline: 'Frequent Shopper'
  },
  New: {
    tier: 'New',
    label: 'New Customer',
    badgeBg: '#f0fdf4',
    badgeText: '#166534',
    borderColor: '#86efac',
    icon: '🌱',
    description: '1–2 Purchases',
    tagline: 'First Time / New Shopper'
  }
}

export function getTierInfo(tier: CustomerTier): CustomerTierInfo {
  return TIER_CONFIG[tier] || TIER_CONFIG.New
}
