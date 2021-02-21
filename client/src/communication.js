const {
    data
} = require('jquery');
var net = require('net');
var os = require('os');
const {
    parseHttpLike,
    sanitizeRoomName,
    splitAddress
} = require('./util');

class Communication {
    /** @type {net.Server} */
    server = null;
    /** @type {Number} */
    serverPort = null;
    /** @type {Object.<string, Peer>} */
    peers = {};
    /** @type {Object.<string, Room>} */
    rooms = {};
    /** @type {Object.<string, string>} */
    address2uid = {}
    /** @type {Object.<string, string[]>} */
    address2rid = {}
    eventListeners = {};
    whoami = {
        name: os.hostname(),
        uid: 'u-' + Date.now(),
    };
    /**
     * server-updated
     * room-updated (rid)
     * chat-received (rid, payload)
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
            this.eventListeners[name].forEach(e => e(...args));
        }
    }
    constructor() {
        this.server = net.createServer((socket) => {
            // to catch all unknown connections, we use this
            socket.on('data', (data) => {
                // signal from peers
                var req = parseHttpLike(data);
                if (req.method == 'WHOAMI') {
                    socket.write(`IAMWHO\n\n` + JSON.stringify(this.whoami));
                }
            })
        });
        this.server.listen(() => {
            this.serverPort = this.server.address().port;
        });
    }
    startConnection(host, port) {

        // create new socket and connect
        var peer = new Peer(host, port);
        var socket = new net.Socket();
        peer.socket = socket;

        socket.connect({
            port,
            host,
            localPort: this.serverPort,
        }, () => {
            // to prove it's valid, we need to ask WHOAMI
            socket.write("WHOAMI");
        });

        socket.on('data', (data) => {
            var req = parseHttpLike(data);
            if (peer.uid == 'server') {
                if (req.method == 'WELCOME') {
                    // we're joining to a new room
                    this.respond2Welcome(JSON.parse(req.body));
                } else if (req.method == 'JOINING') {
                    // somebody join to the room
                    this.respond2Joining(JSON.parse(req.body));
                } else if (req.method == 'LEAVING') {
                    //somebody leaves the room
                    this.respond2Leaving(JSON.parse(req.body));
                }
            } else {
                if (req.method == 'IAMWHO') {
                    var body = JSON.parse(req.body);
                    var address = peer.address;
                    if (typeof body == 'object') {
                        peer.connected = true;
                        peer.uid = body.uid;
                        peer.name = body.name || address;
                        // refresh indexes
                        this.peers[body.uid] = peer;
                        this.address2uid[address] = peer.uid;
                        if (this.address2rid[address])
                            this.address2rid[address].forEach(rid => {
                                if (this.rooms[rid].peers[address] !== undefined) {
                                    this.rooms[rid].peers[address] = peer.uid;
                                    this.trigger('room-updated', rid);
                                }
                            });
                        if (peer.uid == 'server') {
                            this.trigger('server-updated');
                        }
                    }
                } else if (req.method == 'MESSAGE') {
                    var body = JSON.parse(req.body);
                    if (body.cid && body.room && body.msg) {
                        var room = this.rooms[body.room];
                        if (room && room.peers[peer.address]) {
                            var payload = {
                                cid: body.cid,
                                msg: body.msg,
                                by: room.peers[peer.address],
                            };
                            room.chats.push(payload);
                            this.trigger('chat-received', rid, payload);
                        }
                    }
                }
            }
        });

        socket.on('error', (err) => {
            if (err.message.includes('ECONNREFUSED')) {
                // failed to connect
                peer.connected = false;
                if (peer.uid == 'server') {
                    this.trigger('server-updated');
                }
            } else {
                console.log('ERROR: ' + err.message);
            }
        })

        socket.on('close', () => {
            this.respond2Closing(peer.address);
            if (peer.uid == 'server') {
                this.trigger('server-updated');
            }
        });
    }
    joinRoom(rid) {
        var peer = this.peers['server'];
        if (peer && peer.connected) {
            peer.socket.write(`JOIN\nROOM: ${rid}`);
        }
    }
    leaveRoom(rid) {
        var peer = this.peers['server'];
        if (peer && peer.connected) {
            peer.write(`LEAVE\nROOM: ${rid}`);
        }
    }
    sendChat(rid, message) {
        // send to all peers
        var room = this.rooms[rid];
        if (room) {
            var payload = 'MESSAGE\n\n' + JSON.stringify({
                cid: Date.now(),
                room: rid,
                msg: message,
            });
            Object.values(room.peers).forEach(uid => {
                var peer = this.peers[uid];
                if (peer && peer.connected) {
                    peer.socket.write(payload);
                }
            });
        }
    }
    closeAllConnection() {
        console.log('quit');
        this.server.close();
        Object.values(this.peers).forEach(e => {
            if (e.socket) {
                e.socket.end();
                e.socket.destroy();
            }
        });
    }
    respond2Welcome(data) {
        // add to index
        var room = this.rooms[data.room] || new Room();
        var rid = room.rid = data.room;
        var peers = {};
        data.peers.forEach(addr => {
            // addresses without uid, we should ask WHOAMI
            if (this.address2uid[addr])
                peers[addr] = this.address2uid[addr]
            else {
                peers[addr] = null;
                this.startConnection(...splitAddress(addr));
            }
            if (this.address2rid[addr]) {
                this.address2rid[addr].push(rid);
            } else {
                this.address2rid[addr] = [rid];
            }
        });
        room.peers = peers;
        this.rooms[rid] = room;
        this.trigger('room-updated', rid);
    }
    respond2Joining(data) {
        // add to respective room
        var rid = data.room;
        var room = this.rooms[rid];
        var addr = data.address;
        if (room && room.peers[addr] === undefined) {
            if (this.address2uid[addr])
                room.peers[addr] = this.address2uid[addr]
            else {
                room.peers[addr] = null;
                this.startConnection(...splitAddress(addr));
            }
            if (this.address2rid[addr]) {
                this.address2rid[addr].push(rid);
            } else {
                this.address2rid[addr] = [rid];
            }
            this.trigger('room-updated', rid);
        }
    }
    respond2Leaving(data) {
        // remove to respective room
        var room = this.rooms[data.room];
        var addr = data.address;
        if (room && room.peers[addr] !== undefined) {
            room.joined = false;
            delete room.peers[addr];
            var i = this.address2rid[addr].findIndex(room.rid);
            if (i >= 0) {
                delete this.address2rid[addr][i];
            }
            this.trigger('room-updated', room.rid);
        }
    }
    respond2Closing(addr) {
        // detach anything that associates this address
        // (but don't delete saved stuff)
        if (this.address2uid[addr]) {
            var peer = this.peers[this.address2uid[addr]];
            delete this.address2uid[addr];
            if (peer) {
                peer.connected = false;
                peer.socket.destroy();
                peer.socket = null;
            }
        }
        if (this.address2rid[addr]) {
            this.address2rid[addr].forEach(rid => {
                var room = this.rooms[rid];
                if (room) {
                    delete room.peers[addr];
                    this.trigger('room-updated', rid);
                }
            });
            delete this.address2rid[addr];
        }
    }
}

class Room {
    /** @type {string} */
    rid = null;
    /** {cid, body, timestamp} */
    chats = [];
    /** @type {Object.<string,string>} address (rid) to peer (uid) map */
    peers = {};
    joined = true;
    toObject() {
        return {
            rid: this.rid,
            chats: this.chats,
            peers: this.peers,
        }
    }
}

class Peer {
    /** @type {string} */
    uid = null;
    /** @type {string} */
    name = null;
    /** @type {string} */
    host = null;
    /** @type {Number} */
    port = null;
    /** @type {string} */
    address = null;
    /** @type {net.Socket} */
    socket = null;
    /** @type {boolean} */
    connected = false;
    constructor(host, port) {
        this.host = host;
        this.port = port;
    }
    get address() {
        return `${this.host}:${this.port}`;
    }
    toObject() {
        return {
            uid: this.uid,
            name: this.name,
            host: this.host,
            port: this.port,
            connected: this.connected
        }
    }
}


module.exports = {
    Communication,
    Peer,
    Room
};