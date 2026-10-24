// This verification must not reach production or any other network service.
const deny = () => {
  throw new Error("Network access is disabled for Draft Ranker homepage verification");
};
globalThis.fetch = deny;
for (const protocol of ["node:http", "node:https"]) {
  const client = require(protocol);
  client.request = deny;
  client.get = deny;
}
for (const protocol of ["node:net", "node:tls"]) {
  const client = require(protocol);
  client.connect = deny;
  if (client.createConnection) client.createConnection = deny;
}
