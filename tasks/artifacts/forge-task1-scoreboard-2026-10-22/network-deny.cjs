const net = require('node:net');
const http = require('node:http');
const https = require('node:https');
const deny = () => { throw new Error('AUDIT_OFFLINE_NETWORK_BLOCKED'); };
net.connect = net.createConnection = deny;
net.Socket.prototype.connect = deny;
http.request = http.get = https.request = https.get = deny;
globalThis.fetch = async () => { throw new Error('AUDIT_OFFLINE_NETWORK_BLOCKED'); };
require('node:module').syncBuiltinESMExports();
