import { vi } from "vitest";
vi.stubGlobal("fetch", async () => { throw new Error("AUDIT_OFFLINE_NETWORK_BLOCKED"); });
