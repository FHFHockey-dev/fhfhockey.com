import http from 'node:http';
import https from 'node:https';
const deny = () => { throw new Error('Offline Decisions verification forbids network I/O'); };
http.request = deny;
http.get = deny;
https.request = deny;
https.get = deny;
globalThis.fetch = deny;
