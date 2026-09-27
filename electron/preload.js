const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onUpdateAvailable: (cb) =>
    ipcRenderer.on('update-available', cb),
  onUpdateDownloaded: (cb) =>
    ipcRenderer.on('update-downloaded', cb),
  restartApp: () =>
    ipcRenderer.send('restart-app'),
  platform: process.platform,
  checkForUpdates: () => ipcRenderer.invoke('update:check'),

  // WhatsApp, running inside this app (no separate service needed)
  whatsapp: {
    connect: (opts) => ipcRenderer.invoke('whatsapp:connect', opts),
    status: () => ipcRenderer.invoke('whatsapp:status'),
    send: (phone, text) => ipcRenderer.invoke('whatsapp:send', { phone, text }),
    sendDocument: (payload) => ipcRenderer.invoke('whatsapp:sendDocument', payload),
    logout: () => ipcRenderer.invoke('whatsapp:logout'),
    onStatus: (cb) => {
      const h = (_e, p) => cb(p)
      ipcRenderer.on('whatsapp:status', h)
      return () => ipcRenderer.removeListener('whatsapp:status', h)
    },
  },

  // Printing. Absent in the browser build, which falls back to the print dialog.
  printing: {
    list: () => ipcRenderer.invoke('printers:list'),
    print: (payload) => ipcRenderer.invoke('print:html', payload),
    raw: (payload) => ipcRenderer.invoke('print:raw', payload),
    rawText: (payload) => ipcRenderer.invoke('print:rawText', payload),
    rasterBill: (payload) => ipcRenderer.invoke('print:rasterBill', payload),
    rasterLabels: (payload) => ipcRenderer.invoke('print:rasterLabels', payload),
    queueCount: (names) => ipcRenderer.invoke('printers:queueCount', names),
    clearQueue: (names) => ipcRenderer.invoke('printers:clearQueue', names),
    renderPDF: (payload) => ipcRenderer.invoke('pdf:render', payload),
  }
})
