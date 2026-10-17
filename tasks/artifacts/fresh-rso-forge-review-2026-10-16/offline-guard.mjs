import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
const blocked = () => { throw new Error('Independent audit forbids network access'); };
globalThis.fetch = blocked;
net.connect = blocked; net.createConnection = blocked; tls.connect = blocked;
http.request = blocked; http.get = blocked; https.request = blocked; https.get = blocked;
