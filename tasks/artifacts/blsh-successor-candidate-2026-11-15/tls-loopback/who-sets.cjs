const KEY = Symbol.for("undici.globalDispatcher.1");
const state = () => globalThis[KEY] === undefined ? "unset" : globalThis[KEY].constructor.name;
require(process.cwd() + "/node_modules/cheerio"); console.log("after cheerio (main):", state());
const keys = Object.keys(require.cache).filter(k => /node_modules\/undici\//.test(k));
console.log("undici modules loaded:", keys.length, keys.slice(0, 2).map(k => k.replace(process.cwd(), ".")));
const pkg = keys.length ? require(keys[0].replace(/(node_modules\/undici)\/.*/, "$1/package.json")) : null; console.log("undici version:", pkg && pkg.version);
const desc = Object.getOwnPropertyDescriptor(globalThis, KEY); console.log("descriptor:", JSON.stringify({ writable: desc.writable, configurable: desc.configurable, enumerable: desc.enumerable }));
console.log("cheerio package undici dep:", require("./node_modules/cheerio/package.json").dependencies?.undici);
