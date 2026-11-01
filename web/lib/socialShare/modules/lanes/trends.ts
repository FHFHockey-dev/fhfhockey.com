import type { AnyShareModule } from "../contract";
import { roleWatchModule } from "../roleWatch";
import { whatChangedModule } from "../whatChanged";

/** What Changed, Role Watch (SS 2.0, 4.0). Owned by this lane alone; add its posts here. */
export const trendModules: readonly AnyShareModule[] = [whatChangedModule, roleWatchModule];
