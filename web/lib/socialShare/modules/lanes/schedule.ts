import type { AnyShareModule } from "../contract";
import { offNightEdgeModule } from "../offNightEdge";

/** Off-Night Edge (SS 6.0). Owned by this lane alone; add its posts here. */
export const scheduleModules: readonly AnyShareModule[] = [offNightEdgeModule];
