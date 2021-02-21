// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

const {
  contextBridge,
  ipcRenderer
} = require('electron');

contextBridge.exposeInMainWorld(
  "api", {
    send: (channel, ...data) => {
      // whitelist channels
      let validChannels = ['join-room', 'leave-room', 'send-chat', 'connect-server', 'close-server'];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, ...data);
      }
    },
    receive: (channel, func) => {
      let validChannels = ['server-updated', 'room-updated', 'chat-received'];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    get: (channel, ...data) => {
      // whitelist channels
      let validChannels = ['get-server-info', 'get-room-info', 'get-peer-info', 'get-room-list', 'user-info'];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...data);
      }
    },
  }
);