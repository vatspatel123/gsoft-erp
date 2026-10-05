// Keyboard-first entry: Enter moves to the next field, in screen order, so a
// bill or a purchase can be keyed in without the mouse.
//
// - A field that does its own thing on Enter (POS scan, a search box) either
//   calls preventDefault or carries data-enter="own"; it is left alone.
// - Inside a pop-up, the move stays inside the pop-up.
// - From the last field, Enter goes to the screen's main button
//   (data-enter-submit) — it focuses it, a second Enter presses it, so nothing
//   is ever saved by accident.
// - Textareas keep Enter for new lines; buttons keep Enter for clicking.

const FIELDS = 'input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=file]), select, textarea'

const usable = (f: HTMLElement) => {
  const x = f as HTMLInputElement
  return !x.disabled && !x.readOnly && f.tabIndex >= 0 && f.offsetParent !== null
}

/** The open pop-up the field sits in, or the whole page. */
function scopeOf(el: HTMLElement): HTMLElement {
  for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
    if (getComputedStyle(n).position === 'fixed') return n
  }
  return document.body
}

export function enterToNextField(e: KeyboardEvent) {
  if (e.key !== 'Enter' || e.defaultPrevented || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return
  const el = e.target as HTMLElement
  if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) return
  if (el instanceof HTMLInputElement && ['button', 'submit', 'file'].includes(el.type)) return
  if (el.closest('[data-enter="own"]')) return

  // Only this layer's fields: a page field must not jump into a floating panel.
  const scope = scopeOf(el)
  const inLayer = (f: HTMLElement) => usable(f) && scopeOf(f) === scope
  const fields = Array.from(scope.querySelectorAll<HTMLElement>(FIELDS)).filter(inLayer)
  const next = fields[fields.indexOf(el) + 1]
  const target = next || Array.from(scope.querySelectorAll<HTMLElement>('[data-enter-submit]')).find(inLayer)
  if (!target) return            // nothing after it: let Enter do its usual job (e.g. sign in)

  e.preventDefault()
  target.focus()
  // Typing over a field is faster than clearing it first.
  if (target instanceof HTMLInputElement && !['checkbox', 'radio', 'date'].includes(target.type)) {
    try { target.select() } catch { /* some input types can't select */ }
  }
}
