import { beforeEach, afterEach, vi } from "vitest";
beforeEach(() => vi.stubGlobal("fetch", () => { throw new Error("Reviewer forbids network access"); }));
afterEach(() => vi.unstubAllGlobals());
