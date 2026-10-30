// PROBE (must fail): test-runner actual-module loader
import { vi } from "vitest";
export const probe = () => vi.importActual("../player-cards/evidenceBundle");
