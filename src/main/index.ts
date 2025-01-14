import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { get } from 'svelte/store'

import icon from '../../resources/icon.png?asset'

import '$main/sql'
import '$main/wallet'
import * as pools from '$main/pools'
import '$main/ens'
import '$main/contact'
import * as indexer from '$main/indexer'
import '$main/chain/state'
import '$main/msgboard'
import * as autoUpdate from '$main/auto-update'

import { main, mainProps } from '$main/window'
import { config } from '$main/config'

async function createWindow(): Promise<void> {
  // Create the browser window.
  indexer.start()
  await pools.init()
  const mainWindow = new BrowserWindow({
    ...get(mainProps),
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      devTools: process.env.NODE_ENV_ELECTRON_VITE === 'development',
    },
  })
  main.set(mainWindow)
  if (get(config).autoUpdate) {
    autoUpdate.start()
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })
  mainWindow.on('closed', () => {
    main.set(null)
  })
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
  const saveBounds = () => {
    mainProps.update(($props) => ({
      ...$props,
      ...mainWindow.getBounds(),
    }))
  }
  mainWindow.on('resized', saveBounds)
  mainWindow.on('moved', saveBounds)
  mainWindow.on('close', saveBounds)
  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  try {
    mainWindow.webContents.openDevTools()
  } catch {
    // ignore
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')
  // session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  //   callback({ responseHeaders: Object.assign({
  //       "Content-Security-Policy": [ "default-src 'self'" ]
  //   }, details.responseHeaders)});
  // });

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // // IPC test
  // ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.

// const resourcesDir = join(__dirname, '..', '..', 'resources')
// ipcMain.handle('read-file', async (_event, filePath) => {
//   return await readFile(join(resourcesDir, ...filePath))
// })
