const { app, BrowserWindow, shell, ipcMain, protocol, net } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')

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

    const distPath = path.join(__dirname, '..', 'dist', filePath)
    return net.fetch('file://' + distPath)
  })

  createWindow()

  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify()
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

autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update-available')
})

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update-downloaded')
})

ipcMain.on('restart-app', () => {
  autoUpdater.quitAndInstall()
})
