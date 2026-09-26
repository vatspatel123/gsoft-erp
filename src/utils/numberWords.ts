/**
 * Indian-system number to words, for the "Bill Amount" line a GST invoice
 * must carry. Lakh and crore, not million — "One Lakh Twenty Thousand".
 */
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

const under100 = (n: number): string =>
  n < 20 ? ONES[n] : (TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''))

const under1000 = (n: number): string => {
  const h = Math.floor(n / 100), r = n % 100
  return [h ? ONES[h] + ' Hundred' : '', r ? under100(r) : ''].filter(Boolean).join(' ')
}

/** 1318 -> "One Thousand Three Hundred Eighteen" */
export function inWords(n: number): string {
  const v = Math.floor(Math.abs(Number(n) || 0))
  if (v === 0) return 'Zero'
  const parts: string[] = []
  const crore = Math.floor(v / 10000000)
  const lakh = Math.floor((v % 10000000) / 100000)
  const thousand = Math.floor((v % 100000) / 1000)
  const rest = v % 1000
  if (crore) parts.push(under1000(crore) + ' Crore')
  if (lakh) parts.push(under100(lakh) + ' Lakh')
  if (thousand) parts.push(under100(thousand) + ' Thousand')
  if (rest) parts.push(under1000(rest))
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

/** 1318.00 -> "One Thousand Three Hundred Eighteen Only" */
export function rupeesInWords(n: number): string {
  const v = Number(n) || 0
  const whole = Math.floor(v)
  // Round, don't truncate: 62.755 is 76 paise on the invoice, not 75.
  const paise = Math.round((v - whole) * 100)
  const head = inWords(whole)
  if (!paise) return `${head} Only`
  return `${head} And ${inWords(paise)} Paise Only`
}
