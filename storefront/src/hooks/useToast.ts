import { useState, useRef, useCallback } from 'react'

export function useToast() {
  const [text, setText] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const fire = useCallback((msg: string) => {
    window.clearTimeout(timer.current)
    setText(msg)
    timer.current = window.setTimeout(() => setText(null), 2200)
  }, [])

  return { text, fire }
}
