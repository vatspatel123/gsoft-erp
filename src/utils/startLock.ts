// When the desktop app asks for the password on opening: only after the PC was shut down or restarted,
// or after an update. Closing and reopening the app never asks. (Log out still always asks.)
const KEY = 'gsoft_unlocked_for'

export interface StartInfo { pcSession: string | null; version: string }

/** pcSession null = could not be read: then only an update can ask, so the shop is never wrongly locked out. */
export function passwordNeeded(saved: Partial<StartInfo> | null, now: StartInfo): boolean {
  if (!saved) return true
  if (saved.version !== now.version) return true
  return !!now.pcSession && !!saved.pcSession && saved.pcSession !== now.pcSession
}

const readInfo = async (): Promise<StartInfo | null> => {
  try { return (await (window as any).electronAPI?.startInfo?.()) || null } catch { return null }
}

export async function startNeedsPassword(): Promise<boolean> {
  const now = await readInfo()
  if (!now) return false   // the browser version has no PC to check
  let saved = null
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null') } catch { /* treated as first time */ }
  return passwordNeeded(saved, now)
}

/** The password was just typed: no more asking until the next restart or update. */
export async function markUnlocked(): Promise<void> {
  const now = await readInfo()
  if (now) { try { localStorage.setItem(KEY, JSON.stringify(now)) } catch { /* asks again next time */ } }
}
