declare global {
  interface Window {
    electronAPI?: {
      onUpdateAvailable: (cb: any) => void
      onUpdateDownloaded: (cb: any) => void
      restartApp: () => void
      platform: string
    }
  }
}

export {};
