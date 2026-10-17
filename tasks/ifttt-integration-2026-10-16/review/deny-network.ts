import http from 'node:http';
import https from 'node:https';
const blocked = () => { throw new Error('Independent IFTTT review forbids external network I/O'); };
http.request = blocked as typeof http.request;
http.get = blocked as typeof http.get;
https.request = blocked as typeof https.request;
https.get = blocked as typeof https.get;
globalThis.fetch = blocked as typeof fetch;
