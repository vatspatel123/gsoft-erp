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
    const channel = supabase.channel(`live:${key}:${Math.random().toString(36).slice(2)}`)
    for (const table of key.split(',')) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        clearTimeout(timer)
        timer = setTimeout(() => latest.current(), 800)
      })
    }
    channel.subscribe()
    return () => { clearTimeout(timer); void supabase.removeChannel(channel) }
  }, [key])
}
