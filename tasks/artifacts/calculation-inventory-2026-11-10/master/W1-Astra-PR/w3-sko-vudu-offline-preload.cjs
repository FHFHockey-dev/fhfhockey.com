// Test-run safety: no real fetch or HTTP(S) requests. Test-owned mocks may replace these.
const deny = () => { throw new Error('Offline peer-review test: outbound request forbidden'); };
globalThis.fetch = deny;
for (const name of ['node:http', 'node:https']) {
 const module = require(name); module.request = deny; module.get = deny;
}
require('node:module').syncBuiltinESMExports();
