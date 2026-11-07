const fs = require('node:fs');
const original = fs.readFileSync;
const forbidden = /(?:2024-04-18\.v1\.json|2026-10-26\.arm-a-official-overlay\.v2\.json|2026-10-28\.arm-a-canonical-repaired\.v2\.json|display-profiles\.jsonl)$/;
fs.readFileSync = function(path, ...args) {
  if (forbidden.test(String(path))) throw new Error('Default test attempted retained read: ' + path);
  return original.call(this, path, ...args);
};
require('node:module').syncBuiltinESMExports();
