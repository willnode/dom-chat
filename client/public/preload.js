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
    connection: () => {
      return ipcRenderer.invoke('get-connection-status');
    },
  }
)

contextBridge.exposeInMainWorld(
  "api", {
      send: (channel, ...data) => {
          // whitelist channels
          let validChannels = ['join-room', 'connect-server'];
          if (validChannels.includes(channel)) {
              ipcRenderer.send(channel, ...data);
          }
      },
      receive: (channel, func) => {
          let validChannels = ["connection-changed"];
          if (validChannels.includes(channel)) {
              // Deliberately strip event as it includes `sender`
              ipcRenderer.on(channel, (event, ...args) => func(...args));
          }
      }
  }
);
