export type WhatsAppStatus = 'disconnected' | 'qr' | 'connecting' | 'connected'

export interface WhatsAppState {
  status: WhatsAppStatus
  qr?: string | null
  me?: string | null
  name?: string | null
  reason?: string
}

declare global {
  const __APP_VERSION__: string

  interface Window {
    electronAPI?: {
      onUpdateAvailable: (cb: any) => void
      onUpdateDownloaded: (cb: any) => void
      restartApp: () => void
      platform: string
      checkForUpdates?: () => Promise<{ ok: boolean; version?: string | null; current?: string; reason?: string }>
      whatsapp?: {
        connect: (opts?: { reset?: boolean }) => Promise<WhatsAppState>
        status: () => Promise<WhatsAppState>
        send: (phone: string, text: string) => Promise<{ ok: boolean; id?: string | null; error?: string }>
        sendDocument: (p: { phone: string; pdfBase64: string; fileName: string; caption: string })
          => Promise<{ ok: boolean; id?: string | null; error?: string }>
        logout: () => Promise<{ ok: boolean }>
        onStatus: (cb: (s: WhatsAppState) => void) => () => void
      }
      printing?: {
        list: () => Promise<{ name: string; displayName: string; isDefault: boolean; status?: number }[]>
        print: (payload: {
          html: string; deviceName?: string; widthMm?: number; settleMs?: number; copies?: number
        }) => Promise<{ ok: boolean; reason?: string }>
        raw?: (payload: { deviceName?: string; ops: unknown[] })
          => Promise<{ ok: boolean; reason?: string }>
        queueCount?: (names: string[]) => Promise<{ count: number }>
        clearQueue?: (names: string[]) => Promise<{ removed: number; reason?: string }>
        renderPDF?: (payload: { html: string; widthMm?: number })
          => Promise<{ ok: boolean; base64?: string; error?: string }>
      }
    }
  }
}

export {};
