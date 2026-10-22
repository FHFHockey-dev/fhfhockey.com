'use strict';
// Preloaded before the TypeScript loader and any application module.
const state = { blockedNetwork: [], blockedClientCreates: 0, blockedEnvLoads: 0 };
globalThis.__FHFH_OFFLINE_GUARD = state;
const deny = (name) => function () {
  state.blockedNetwork.push(name);
  throw new Error(`FHFH offline guard: ${name} disabled`);
};
require('node:net').Socket.prototype.connect = deny('socket.connect');
require('node:tls').connect = deny('tls.connect');
for (const name of ['node:http', 'node:https']) {
  const mod = require(name);
  mod.request = deny(`${name}.request`);
  mod.get = deny(`${name}.get`);
}
require('node:dgram').createSocket = deny('dgram.createSocket');
globalThis.fetch = deny('fetch');
const dns = require('node:dns');
for (const key of ['lookup', 'resolve', 'resolve4', 'resolve6', 'reverse']) {
  dns[key] = deny(`dns.${key}`);
  if (dns.promises[key]) dns.promises[key] = deny(`dns.promises.${key}`);
}
// Never initialize a provider client. The bootstrap module's server import is
// lazy; its pure functions do not need a client or any secret/configuration.
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'dotenv') {
    state.blockedEnvLoads += 1;
    throw new Error('FHFH offline guard: dotenv import disabled');
  }
  const value = originalLoad.apply(this, arguments);
  if (request === '@supabase/supabase-js') {
    return new Proxy(value, {
      get(target, key) {
        if (key === 'createClient') return function () {
          state.blockedClientCreates += 1;
          throw new Error('FHFH offline guard: provider client creation disabled');
        };
        return Reflect.get(target, key);
      },
    });
  }
  return value;
};
