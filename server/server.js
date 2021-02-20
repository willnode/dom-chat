const WebSocket = require('ws');

const wss = new WebSocket.Server({
    port: 8080
});

const rooms = {};

wss.on('connection', function connection(ws, req) {

    var address = req.socket.remoteAddress + ":" + req.socket.remotePort;
    var room = 'test';

    ws.on('message', function (message) {
        broadcastMessage(room, address, message);
    });

    ws.on("close", function () {
        delete rooms[room][address];
        broadcastMessage(room, "", address + " leaving");
    });

    (function () {
        var identifier = {
            name: address,
            address: address,
            socket: ws,
        }
        if (!rooms[room]) {
            rooms[room] = {
                [address]: identifier
            };
        } else {
            rooms[room][address] = identifier;
        }
        broadcastMessage(room, "", address + " joined");
    })();

});

function broadcastMessage(room, source, message) {

    var payload = JSON.stringify({
        'name': source ? rooms[room][source].name : '[Server]',
        'message': message,
    });

    Object.keys(rooms[room]).forEach(adr => {
        rooms[room][adr].socket.send(payload);
    });
}

console.log('listening ' + 8080)