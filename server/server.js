var net = require('net');

const rooms = {};
const roomsOfAddresses = {};
const {
    parseHttpLike,
    sanitizeRoomName
} = require('./util');

var server = net.createServer(function (socket) {

    // new room joined
    var address = socket.remoteAddress + ":" + socket.remotePort;

    socket.on('data', function (data) {
        var req = parseHttpLike(data);
        var room = sanitizeRoomName(req.headers['room'] || '');
        if (req.method == 'JOIN') {
            if (!room) {
                socket.write('INVALID');
                return;
            }
            // TODO: add configurable name + room + authentication
            if (!rooms[room] || !rooms[room][address]) {
                // send welcome to room
                socket.write('WELCOME\n\n' + JSON.stringify({
                    room: room,
                    address: address,
                    peers: Object.keys(rooms[room] || {}),
                }));
                // add to room
                var identifier = {
                    address: address,
                    socket: socket,
                }
                if (!rooms[room]) {
                    rooms[room] = {
                        [address]: identifier
                    };
                } else {
                    // check if allocation OK
                    var addresses = Object.keys(rooms[room]);
                    if (addresses.length > 20) {
                        socket.write('ROOMFULL');
                        return;
                    }
                    // tell everyone else
                    addresses.forEach(adr => {
                        rooms[room][adr].socket.write('JOINING\n\n' + JSON.stringify({
                            room: room,
                            address: address,
                        }));
                    });
                    rooms[room][address] = identifier;
                    console.log('added room');
                }
                if (roomsOfAddresses[address]) {
                    roomsOfAddresses[address].push(room);
                } else {
                    roomsOfAddresses[address] = [room];
                }
            }
        } else if (req.method == 'CHECK') {
            // check if room free
            if (!room) {
                socket.write('INVALID');
            } else if (rooms[room]) {
                socket.write('RESERVED');
            } else {
                socket.write('AVAILABLE');
            }
            return;
        } else if (req.method == 'LEAVE') {
            delete rooms[room][address];
            if ((i = roomsOfAddresses[address].indexOf(room)) >= 0) {
                delete roomsOfAddresses[address][i];
            }
            if (Object.keys(rooms[room]).length == 0) {
                delete rooms[room];
            } else {
                // tell everyone else
                Object.keys(rooms[room]).forEach(adr => {
                    rooms[room][adr].socket.write('LEAVING\n\n' + JSON.stringify({
                        room: room,
                        address: adr,
                    }));
                });
            }

        } else if (req.method == 'WHOAMI') {
            socket.write('IAMWHO\n\n'+JSON.stringify({
                uid: 'server',
                name: 'DOM-CHAT SERVER',
            }));
            return;
        }
    })
    socket.on('error', function (err) {
        console.log(err);
    })
    socket.on('close', function () {
        if (!roomsOfAddresses[address]) {
            return;
        }
        roomsOfAddresses[address].forEach(room => {
            delete rooms[room][address];

            if (Object.keys(rooms[room]).length == 0) {
                delete rooms[room];
            } else {
                // tell everyone else
                Object.keys(rooms[room]).forEach(adr => {
                    rooms[room][adr].socket.write('LEAVING\n\n' + JSON.stringify({
                        room: room,
                        address: adr,
                    }));
                });
            }
        });
        delete roomsOfAddresses[address];
    })
});
server.listen(8080, function () {
    console.log('Listening on port ' + server.address().port);
});