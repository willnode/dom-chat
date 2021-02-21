const {
    data
} = require('jquery');
var net = require('net');

class Communication {
    /** @type {net.Socket} */
    socket = null;
    eventListeners = {};
    connected = false;
    /**
     * connection-changed -> connected (bool);
     * chat_received -> room (string), data (mixed);
     */
    on(name, fun) {
        if (this.eventListeners[name]) {
            this.eventListeners[name].push(fun);
        } else {
            this.eventListeners[name] = [fun];
        }
    }
    trigger(name, ...args) {
        if (this.eventListeners[name]) {
            this.eventListeners[name].forEach(e => {
                e(...args);
            });
        }
    }
    startConnecting(host, port) {
        var socket = new net.Socket();
        this.socket = socket;
        socket.connect(port, host, () => {
            this.connected = true;
            this.trigger('connection-changed', true);
        });

        socket.on('data', (data) => {
            console.log('Received: ' + data);
        });

        socket.on('error', (err) => {
            if (err.message.includes('ECONNREFUSED')) {
                this.trigger('connection-changed', false);
            }
        })

        socket.on('close', () => {
            this.connected = false;
            this.trigger('connection-changed', false);
        });
    }
    joinServer(room, name) {
        this.socket.write(`JOIN\nROOM: ${room}\nNAME: ${name}`);
        console.log('Joined room');
    }
    closeConnection() {
        if (this.socket) {
            this.socket.destroy();
        }
    }
}

module.exports = Communication;