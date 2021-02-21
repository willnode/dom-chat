// Modules to control application life and create native browser window
const {
  app,
  BrowserWindow,
  ipcMain
} = require('electron')

const path = require('path')
const {
  Communication
} = require('./src/communication');

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, 'public/preload.js'),
      contextIsolation: true
    }
  })

  // and load the index.html of the app.
  mainWindow.loadFile('public/index.html')

  // Open the DevTools.
  mainWindow.webContents.openDevTools()

  mainWindow.maximize();

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
  });

  ['server-updated', 'room-updated', 'chat-received'].forEach(key => {
    com.on(key, function (...args) {
      if (!mainWindow.isDestroyed())
        mainWindow.webContents.send(key, ...args);
    })
  });
  ipcMain.handle('get-server-info', function (event) {
    return (com.peers['server'] && com.peers['server'].toObject()) || null;
  })
  ipcMain.handle('get-room-info', function (event, rid) {
    console.log([rid]);
    return (com.rooms[rid] && com.rooms[rid].toObject()) || null;
  })
  ipcMain.handle('get-peer-info', function (event, uid) {
    return (com.peers[uid] && com.peers[uid].toObject()) || null;
  })
  ipcMain.handle('get-room-list', function (event, uid) {
    return Object.keys(com.rooms);
  })
  ipcMain.handle('user-info', function (event, user) {
    if (user && typeof user == 'object') {
      com.whoami = user;
    }
    return com.whoami;
  })
  ipcMain.on('join-room', function (event, room) {
    com.joinRoom(room);
  })
  ipcMain.on('leave-room', function (event, room) {
    com.leaveRoom(room);
  })
  ipcMain.on('send-chat', function (event, room, message) {
    com.sendChat(room, message);
  })
  ipcMain.on('connect-server', function (event) {
    com.startConnection('localhost', 8080);
  })
  ipcMain.on('close-server', function (event) {
    com.closeAllConnection();
  })

})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.