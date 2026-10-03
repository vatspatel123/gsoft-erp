// Every date the app shows is dd-mm-yyyy, the shop's format. Use these instead
// of toLocaleDateString, whose output depends on the PC's language settings.

type DateLike = Date | string | number | null | undefined
const p2 = (n: number) => String(n).padStart(2, '0')
const toDate = (d: DateLike): Date | null => {
  if (d === null || d === undefined || d === '') return null
  const t = d instanceof Date ? d : new Date(d)
  return isNaN(t.getTime()) ? null : t
}

/** 02-10-2026 */
export function fmtDate(d: DateLike): string {
  const t = toDate(d)
  return t ? `${p2(t.getDate())}-${p2(t.getMonth() + 1)}-${t.getFullYear()}` : ''
}

/** 02-10 — chart axes and birthdays, where the year is noise. */
export function fmtDayMonth(d: DateLike): string {
  const t = toDate(d)
  return t ? `${p2(t.getDate())}-${p2(t.getMonth() + 1)}` : ''
}

/** 02-10-2026 04:35 pm */
export function fmtDateTime(d: DateLike): string {
  const t = toDate(d)
  if (!t) return ''
  const h = t.getHours()
  return `${fmtDate(t)} ${p2(h % 12 || 12)}:${p2(t.getMinutes())} ${h < 12 ? 'am' : 'pm'}`
}

/** Thursday, 02-10-2026 */
export function fmtLongDate(d: DateLike): string {
  const t = toDate(d)
  return t ? `${t.toLocaleDateString('en-IN', { weekday: 'long' })}, ${fmtDate(t)}` : ''
}
