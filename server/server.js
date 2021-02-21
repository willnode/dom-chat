var net = require('net');

const rooms = {};
const roomsOfAddresses = {};
const {
    parseHttpLike,
    sanitizeUsername
} = require('./util');

var server = net.createServer(function (socket) {

    // new room joined
    var address = socket.remoteAddress + ":" + socket.remotePort;

    socket.on('data', function (data) {
        var req = parseHttpLike(data);
        if (req.method == 'JOIN') {
            var room = sanitizeUsername(req.headers['room']);
            var name = req.headers['name'];
            if (!room || !name) {
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
                    name: address,
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
                            name: name,
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
            var room = sanitizeUsername(req.headers['room']);
            if (!room) {
                socket.write('INVALID');
            } else if (rooms[room]) {
                socket.write('RESERVED');
            } else {
                socket.write('AVAILABLE');
            }
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