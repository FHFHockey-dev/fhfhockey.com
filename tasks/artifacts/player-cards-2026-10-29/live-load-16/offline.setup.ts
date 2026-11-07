import { afterEach, vi } from "../../../../web/node_modules/vitest/dist/index.js";
import { cleanup } from "../../../../web/node_modules/@testing-library/react/dist/index.js";
import "../../../../web/node_modules/@testing-library/jest-dom/vitest";
vi.stubGlobal("fetch", vi.fn(() => { throw new Error("External requests are forbidden in this offline test."); }));
afterEach(() => cleanup());
