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
        uid: os.hostname(),
    };
    /**
     * connection-changed -> connected (bool);
     * chat-sent -> room (string), peer (mixed);
     * chat-incoming -> room (string), data (mixed);
     * file-incoming -> room (string), name (string);
     * room-joining -> room (string), peer (mixed);
     * room-leaving -> room (string), peer (mixed);
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
                            if (this.rooms[rid].peers[address]) {
                                this.rooms[rid].peers[address] = peer.uid;
                            }
                        });
                }
            } else if (peer.uid == 'server') {
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
            }
        });

        socket.on('error', (err) => {
            if (err.message.includes('ECONNREFUSED')) {
                // failed to connect
                peer.connected = false;
            } else {
                console.log('ERROR: ' + err.message);
            }
        })

        socket.on('close', () => {
            this.respond2Closing(peer.address);
        });
    }
    joinServer(room) {
        this.socket.write(`JOIN\nROOM: ${room}`);
        console.log('Joined room');
    }
    closeAllConnection() {
        Object.values(this.peers).forEach(e => {
            if (e.socket) {
                e.socket.destroy();
            }
        });
    }
    respond2Welcome(data) {
        // add to index
        var room = new Room();
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
        rooms[rid] = room;
    }
    respond2Joining(data) {
        // add to respective room
        var room = this.rooms[data.room];
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
        }
    }
    respond2Leaving(data) {
        // remove to respective room
        var room = this.rooms[data.room];
        var addr = data.address;
        if (room && room.peers[addr] !== undefined) {
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