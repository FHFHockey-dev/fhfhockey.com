import { afterEach, beforeEach, vi } from "vitest";
const forbidden = () => { throw new Error("Reviewer forbids network calls"); };
beforeEach(() => { vi.stubGlobal("fetch", forbidden); });
afterEach(() => { vi.unstubAllGlobals(); });
