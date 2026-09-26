const { app, BrowserWindow, shell, ipcMain, protocol, net } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const { pathToFileURL } = require('url')

const isDev =
  process.env.NODE_ENV === 'development' ||
  !app.isPackaged

// Register app:// as a privileged scheme so module scripts
// load correctly (avoids file:// + crossorigin CORS issue)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
])

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    show: false,
    backgroundColor: '#fdf8ff',
    title: 'Retail ERP',
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadURL('app://app/')
  }

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('Load failed:', errorCode, errorDescription)
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  // Serve dist/ files via app:// protocol
  protocol.handle('app', (request) => {
    const url = new URL(request.url)
    let filePath = url.pathname.replace(/^\//, '')

    if (!filePath) {
      filePath = 'index.html'
    }

    // pathToFileURL, not string concatenation: on Windows a path is
    // C:\...\dist\index.html, and 'file://' + that makes Chromium read "C:" as
    // the hostname. The window then renders blank with no error.
    const distPath = path.join(__dirname, '..', 'dist', filePath)
    return net.fetch(pathToFileURL(distPath).toString())
  })

  createWindow()

  // If this PC has paired before, bring WhatsApp back without another QR scan.
  setTimeout(() => {
    try { require('./whatsapp').restore(mainWindow) } catch (e) {
      console.warn('WhatsApp restore skipped:', e && e.message)
    }
  }, 2500)

  if (!isDev) {
    // The update feed is a private repo the customer has no credentials for, so
    // this check is expected to fail on their machine. It must fail quietly.
    try {
      autoUpdater.checkForUpdatesAndNotify().catch(() => {})
    } catch (e) {
      console.warn('Update check skipped:', e && e.message)
    }
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// electron-updater is an EventEmitter: an 'error' with no listener is thrown and
// takes the whole app down. Without this the app crashed on first launch wherever
// the update feed was unreachable, which is every customer machine.
autoUpdater.on('error', (err) => {
  console.warn('Auto-update unavailable:', (err && err.message) || err)
})

const tell = (channel) => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel)
}

autoUpdater.on('update-available', () => tell('update-available'))
autoUpdater.on('update-downloaded', () => tell('update-downloaded'))

ipcMain.on('restart-app', () => {
  autoUpdater.quitAndInstall()
})

ipcMain.handle('update:check', async () => {
  try {
    const r = await autoUpdater.checkForUpdates()
    const v = r && r.updateInfo && r.updateInfo.version
    return { ok: true, version: v || null, current: app.getVersion() }
  } catch (e) {
    return { ok: false, reason: (e && e.message) || 'Could not reach the update server' }
  }
})

// WhatsApp runs inside this app, so the shop needs no separate service.
// Lazy-required so a failure to load Baileys breaks WhatsApp only, not startup.
const wa = () => require('./whatsapp')

ipcMain.handle('whatsapp:connect', async (_e, opts) => {
  try { return await wa().connect(mainWindow, opts || {}) }
  catch (e) { return { status: 'disconnected', reason: (e && e.message) || 'Failed to start' } }
})
ipcMain.handle('whatsapp:status', () => { try { return wa().getStatus() } catch { return { status: 'disconnected' } } })
ipcMain.handle('whatsapp:send', async (_e, { phone, text }) => {
  try { return await wa().sendMessage(phone, text) }
  catch (e) { return { ok: false, error: (e && e.message) || 'Send failed' } }
})
ipcMain.handle('whatsapp:sendDocument', async (_e, payload) => {
  try { return await wa().sendDocument(payload.phone, payload) }
  catch (e) { return { ok: false, error: (e && e.message) || 'Send failed' } }
})
ipcMain.handle('whatsapp:logout', async () => { try { return await wa().logout() } catch { return { ok: false } } })

// Printing. Lazy-required so a failure here cannot stop the app starting.
const printing = () => require('./print')

ipcMain.handle('printers:list', async () => {
  try { return await printing().listPrinters() }
  catch (e) { console.warn('Printer list failed:', e && e.message); return [] }
})

ipcMain.handle('pdf:render', async (_e, { html, widthMm }) => {
  try { return await printing().renderPDF(html, widthMm) }
  catch (e) { return { ok: false, error: (e && e.message) || 'Could not build the PDF' } }
})

// Receipts go out as raw ESC/POS bytes — see electron/escpos.js. Nothing about
// the printer's paper settings can make this come out blank.
ipcMain.handle('print:raw', async (_e, { deviceName, ops }) => {
  try { return await require('./escpos').printRaw(deviceName, ops) }
  catch (e) { return { ok: false, reason: (e && e.message) || 'Raw print failed' } }
})

ipcMain.handle('print:rawText', async (_e, { deviceName, text }) => {
  try { return await require('./escpos').printRawString(deviceName, text) }
  catch (e) { return { ok: false, reason: (e && e.message) || 'Raw print failed' } }
})

ipcMain.handle('printers:queueCount', async (_e, names) => {
  try { return await require('./escpos').queueCount(names) }
  catch { return { count: 0 } }
})

ipcMain.handle('printers:clearQueue', async (_e, names) => {
  try { return await require('./escpos').clearQueue(names) }
  catch (e) { return { removed: 0, reason: (e && e.message) || 'Could not clear the queue' } }
})

ipcMain.handle('print:html', async (_e, { html, deviceName, widthMm, heightMm, settleMs, copies }) => {
  try { return await printing().printHTML(html, { deviceName, widthMm, heightMm, settleMs, copies }) }
  catch (e) { return { ok: false, reason: (e && e.message) || 'Print failed' } }
})
