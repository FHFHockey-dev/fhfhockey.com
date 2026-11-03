import { afterEach, beforeEach, vi } from "../../../../web/node_modules/vitest/dist/index.js";
import { cleanup } from "../../../../web/node_modules/@testing-library/react/dist/index.js";
beforeEach(() => vi.stubGlobal("fetch", () => { throw new Error("Offline consumer tests forbid network"); }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
