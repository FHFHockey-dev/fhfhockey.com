const deny = () => { throw new Error('Independent audit forbids network access'); };
globalThis.fetch = deny;
for (const name of ['http', 'https']) { const mod = require(name); mod.request = deny; mod.get = deny; }
for (const name of ['net', 'tls']) { const mod = require(name); mod.connect = deny; mod.createConnection = deny; }
