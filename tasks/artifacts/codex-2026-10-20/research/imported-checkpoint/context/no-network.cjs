const deny = () => { throw new Error('FHFH audit: outbound network disabled'); };
require('node:net').Socket.prototype.connect = deny;
require('node:tls').connect = deny;
globalThis.fetch = deny;
