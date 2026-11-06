import type { AnyShareModule } from "../contract";
import { offNightEdgeModule } from "../offNightEdge";
import { teamStreamModule } from "../teamStream";

/** Off-Night Edge (SS 6.0) and Team Stream, which reuses its window, score and pools. Add schedule posts here. */
export const scheduleModules: readonly AnyShareModule[] = [offNightEdgeModule, teamStreamModule];
