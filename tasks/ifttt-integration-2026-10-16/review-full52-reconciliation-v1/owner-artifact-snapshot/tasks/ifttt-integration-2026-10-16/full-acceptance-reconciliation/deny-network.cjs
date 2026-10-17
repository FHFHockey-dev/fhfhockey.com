const blocked = () => { throw new Error('Offline acceptance reconciliation forbids external network I/O'); };
for (const protocol of ['node:http', 'node:https']) {
  const api = require(protocol);
  api.request = blocked;
  api.get = blocked;
}
globalThis.fetch = blocked;
