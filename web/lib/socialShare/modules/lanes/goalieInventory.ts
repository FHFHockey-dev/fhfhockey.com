import type { AnyShareModule } from "../contract";
import { riskyStartsModule } from "../riskyStarts";
import { startSitModule } from "../startSit";

/** Risky Starts, Start/Sit (SS 11.0). Owned by this lane alone; add its posts here. */
export const goalieInventoryModules: readonly AnyShareModule[] = [riskyStartsModule, startSitModule];
