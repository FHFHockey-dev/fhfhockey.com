import { beforeEach, afterEach, vi } from "vitest";
beforeEach(() => vi.stubGlobal("fetch", () => { throw new Error("Visual checkpoint forbids network access"); }));
afterEach(() => vi.unstubAllGlobals());
