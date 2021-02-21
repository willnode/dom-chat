const {
    data
} = require('jquery');
var net = require('net');

const serverPort = 8080;
const serverHost = 'localhost';

class Communication {
    /** @type {net.Socket} */
    socket = null;
    startConnecting() {
        var socket = new net.Socket();
        this.socket = socket;
        socket.connect(serverPort, serverHost, function () {
            console.log('Connected');
        });

        socket.on('data', function (data) {
            console.log('Received: ' + data);
        });

        socket.on('error', function (err) {
            console.log(err);
        })

        socket.on('close', function () {
            console.log('Connection closed');
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