// Modules to control application life and create native browser window
const {
  app,
  BrowserWindow,
  ipcMain
} = require('electron')
const path = require('path')
const Communication = require('./src/communication');

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'public/preload.js'),
      contextIsolation: true
    }
  })

  // and load the index.html of the app.
  mainWindow.loadFile('public/index.html')

  // Open the DevTools.
  mainWindow.webContents.openDevTools()

  return mainWindow;
}

const com = new Communication();

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {

  var mainWindow = createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  })

  com.on('connection-changed', function (connected) {
    if (!mainWindow.isDestroyed())
      mainWindow.webContents.send('connection-changed', connected);
  })

  ipcMain.handle('get-connection-status', function (event) {
    return {
      connected: com.connected,
      host: com.socket.remoteAddress,
      port: com.socket.remotePort,
    }
  })

  ipcMain.on('join-room', function (event, room, name) {
    com.joinServer(room, name);
  })

  ipcMain.on('connect-server', function (event, host, port) {
    com.startConnecting(host, port);
  })

})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    com.closeConnection();
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.