'use strict';
// Explicitly scoped inert module mocks. Existing network blocks remain active.
require('./exposure_offline_guard.cjs');
const fs = require('node:fs');
const Module = require('node:module');
const mock = { dotenvRequests: 0, configCalls: [], clientModuleRequests: 0,
  inertFactoryCalls: [], inertClientOperationAttempts: [], envFileReadAttempts: [] };
globalThis.__FHFH_WRITER_MOCK = mock;
const isEnvFile = p => typeof p === 'string' && /(?:^|\/)\.env(?:\.|$)/.test(p);
for (const method of ['readFileSync', 'readFile', 'openSync', 'open']) {
  const original = fs[method];
  fs[method] = function (p, ...args) {
    if (isEnvFile(String(p))) {
      mock.envFileReadAttempts.push(String(p));
      throw new Error('FHFH writer mock: environment file reads forbidden');
    }
    return original.call(this, p, ...args);
  };
}
for (const method of ['readFile', 'open']) {
  const original = fs.promises[method];
  fs.promises[method] = async function (p, ...args) {
    if (isEnvFile(String(p))) {
      mock.envFileReadAttempts.push(String(p));
      throw new Error('FHFH writer mock: environment file reads forbidden');
    }
    return original.call(this, p, ...args);
  };
}
const inertClient = new Proxy({}, { get(_target, key) {
  mock.inertClientOperationAttempts.push(String(key));
  throw new Error(`FHFH writer mock: client operation ${String(key)} forbidden`);
} });
const dotenvMock = { config(options) { mock.configCalls.push({ ...options }); return { parsed: {} }; } };
const clientMock = { createClient(url, key) {
  if (url !== 'https://fhfh-synthetic.invalid' || key !== 'synthetic-inert-key-not-a-secret') {
    throw new Error('FHFH writer mock: only exact synthetic placeholders allowed');
  }
  mock.inertFactoryCalls.push({ syntheticUrl: url, syntheticKeyMatched: true });
  return inertClient;
} };
const previousLoad = Module._load;
Module._load = function (request, parent, isMain) {
  // Return before previousLoad: the REAL dotenv/client packages never load.
  if (request === 'dotenv') { mock.dotenvRequests++; return dotenvMock; }
  if (request === '@supabase/supabase-js') { mock.clientModuleRequests++; return clientMock; }
  return previousLoad.apply(this, arguments);
};
