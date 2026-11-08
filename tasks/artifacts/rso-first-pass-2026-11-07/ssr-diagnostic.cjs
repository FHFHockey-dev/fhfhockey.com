require('./loopback-only.cjs');
// Verification-only instrumentation. Does not change application or React exports.
const oldError = console.error;
let captured = false;
console.error = function (...args) {
  if (!captured && args.some(a => typeof a === 'string' && a.includes('Invalid hook call'))) {
    captured = true;
    oldError.call(console, '[RSO_FIRST_HOOK_STACK]', new Error('first invalid-hook warning').stack);
    const paths = Object.keys(require.cache).filter(p => /node_modules\/(?:react|react-dom)\//.test(p));
    oldError.call(console, '[RSO_REACT_CACHE_PATHS]', JSON.stringify(paths));
  }
  return oldError.apply(console, args);
};

const Module = require('node:module');
const originalResolve = Module._resolveFilename;
let resolutionCaptured = false;
Module._resolveFilename = function(request, parent, ...rest) {
 const resolved = originalResolve.call(this, request, parent, ...rest);
 if (!resolutionCaptured && typeof resolved === 'string' && resolved.startsWith('/Users/tim/Code/fhfhockey.com/web/node_modules/react/')) {
  resolutionCaptured = true;
  oldError.call(console, '[RSO_CANONICAL_REACT_RESOLUTION]', JSON.stringify({request, parent: parent?.filename, resolved}), new Error('first canonical React resolution').stack);
 }
 return resolved;
};
