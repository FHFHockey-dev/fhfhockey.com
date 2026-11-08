import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { beforeEach, vi } from "vitest";
// Test replacements may supply synthetic fetch responses; real sockets stay denied.
beforeEach(() => {
  const deny = () => { throw new Error("Real network forbidden in native capture candidate tests"); };
  vi.spyOn(http, "request").mockImplementation(deny);
  vi.spyOn(https, "request").mockImplementation(deny);
  vi.spyOn(net, "connect").mockImplementation(deny);
  vi.spyOn(net.Socket.prototype, "connect").mockImplementation(deny);
  vi.spyOn(tls, "connect").mockImplementation(deny);
  vi.stubGlobal("fetch", vi.fn(deny));
});
