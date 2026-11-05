import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Re-run `refresh` when any of these tables changes — on this PC or another —
 * so a list shows new and changed bills without reopening the screen.
 * Changes arriving together (a purchase adds dozens of products) cause one reload.
 * Needs the tables in the supabase_realtime publication (LIVE_UPDATES.sql).
 */
export function useLiveRefresh(tables: string[], refresh: () => void) {
  const latest = useRef(refresh)
  latest.current = refresh
  const key = tables.join(',')
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let dirty = false   // a change arrived while the window was hidden: reload once it is shown again
    const fire = () => { if (document.hidden) { dirty = true; return } dirty = false; latest.current() }
    const onVisible = () => { if (!document.hidden && dirty) { dirty = false; latest.current() } }
    document.addEventListener('visibilitychange', onVisible)
    const channel = supabase.channel(`live:${key}:${Math.random().toString(36).slice(2)}`)
    for (const table of key.split(',')) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        clearTimeout(timer)
        timer = setTimeout(fire, 2500)   // a bill changes several products: one reload for all of them, not one each
      })
    }
    channel.subscribe()
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); void supabase.removeChannel(channel) }
  }, [key])
}
