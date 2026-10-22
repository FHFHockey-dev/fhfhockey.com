// Preload before npm/Vitest. Tests also assert mocked fetch/HTTP were not called.
let attempts = 0;
function blocked() {
  attempts += 1;
  const error = new Error('Network forbidden during Luna readiness verification');
  process.stderr.write(`${error.stack}\n`);
  throw error;
}
for (const name of ['node:http', 'node:https']) {
  const client = require(name);
  client.request = blocked;
  client.get = blocked;
}
const net = require('node:net');
net.connect = blocked;
net.createConnection = blocked;
net.Socket.prototype.connect = blocked;
require('node:tls').connect = blocked;
globalThis.fetch = blocked;
process.on('exit', () => {
  if (attempts) {
    process.stderr.write(`Offline network guard rejected ${attempts} attempted requests\n`);
    process.exitCode = 1;
  }
});
