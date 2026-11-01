import type { AnyShareModule } from "../contract";
import { busyQuietModule } from "../busyQuiet";
import { goalieRescueModule } from "../goalieRescue";
import { ratioImpactModule } from "../ratioImpact";

/** Busy and Quiet, Goalie Category Rescue, Ratio Impact (SS 10.0, 12.0). Owned by this lane alone; add its posts here. */
export const goalieWorkloadModules: readonly AnyShareModule[] = [busyQuietModule, goalieRescueModule, ratioImpactModule];
