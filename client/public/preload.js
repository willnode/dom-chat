// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

const {
  contextBridge,
  ipcRenderer
} = require('electron');
const os = require('os');

contextBridge.exposeInMainWorld(
  'server', {
    joinRoom: (room, name) => {
      ipcRenderer.send('join-room', room, name)
    },
    computerName: os.hostname(),
  }
)

ipcRenderer.on('asynchronous-reply', (event, arg) => {
  console.log(arg) // prints "pong"
})
