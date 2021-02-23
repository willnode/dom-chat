var net = require('net');

var argv = require('minimist')(process.argv.slice(2));
var port = 8080;
if (argv.version) {
    console.log(require('./package.json').version);
    process.exit();
}
if (argv.port) {
    port = parseInt(argv.port);
}

const rooms = {};
const roomsOfAddresses = {};
const socketOfAddresses = {};
const codeToAddress = {};
const {
    parseHttpLike,
    sanitizeRoomName
} = require('./util');

var server = net.createServer(function (socket) {

    socket.on('data', function (data) {
        var req = parseHttpLike(data);
        if (req.method == 'PUNCHHOLE') {
            var code = Date.now() - Math.trunc(Math.random() * 100000);
            var address = codeToAddress[code] = socket.remoteAddress + ":" + socket.remotePort;
            socket.write('OK\n\n' + JSON.stringify({code, address}));
            console.log('punchole: '+address);
        } else if (req.method == 'WHOAMI') {
            var s = socket;
            if (req.headers.code && codeToAddress[req.headers.code]) {
                s = socketOfAddresses[codeToAddress[req.headers.code]]
            }
            s.write('IAMWHO\n\n' + JSON.stringify({
                uid: 'server',
                name: 'DOM-CHAT SERVER',
            }));
            return;
        } else {
            // after the punch-hole
            var address = codeToAddress[req.headers['code'] || ''];
            var room = sanitizeRoomName(req.headers['room'] || '');
            if (!address || !room) {
                socket.write('INVALID');
                return;
            }
            if (req.method == 'JOIN') {
                // send welcome to room
                socket.write('WELCOME\n\n' + JSON.stringify({
                    room: room,
                    address: address,
                    peers: rooms[room] || [],
                }));
                if (!rooms[room]) {
                    rooms[room] = [address];
                } else {
                    // check if allocation OK
                    if (rooms[room].length > 20) {
                        socket.write('ROOMFULL');
                        return;
                    }
                    // tell everyone else
                    rooms[room].forEach(adr => {
                        socketOfAddresses[adr].write('JOINING\nUID: server\n\n' + JSON.stringify({
                            room: room,
                            address: address,
                        }));
                    });
                    rooms[room].push(address);
                }
                if (roomsOfAddresses[address]) {
                    roomsOfAddresses[address].push(room);
                } else {
                    roomsOfAddresses[address] = [room];
                }
                socketOfAddresses[address] = socket;
            } else if (req.method == 'LEAVE') {
                var i;
                if ((i = rooms[room].indexOf(address)) >= 0) {
                    delete rooms[room][i];
                }
                if ((i = roomsOfAddresses[address].indexOf(room)) >= 0) {
                    delete roomsOfAddresses[address][i];
                }
                if (Object.keys(rooms[room]).length == 0) {
                    delete rooms[room];
                } else {
                    // tell everyone else
                    Object.keys(rooms[room]).forEach(adr => {
                        rooms[room][adr].socket.write('LEAVING\nUID: server\n\n' + JSON.stringify({
                            room: room,
                            address: adr,
                        }));
                    });
                }
            }
        }
    })
    socket.on('error', function (err) {
        console.log(err.message);
    })
    socket.on('close', function () {

    })
});
server.listen(port, function () {
    console.log('Listening on port ' + server.address().port);
});