import type { AnyShareModule } from "../contract";
import { playerVsPlayerModule } from "../playerVsPlayer";

/** Player vs Player (SS 5.0). Owned by this lane alone; add its posts here. */
export const comparisonModules: readonly AnyShareModule[] = [playerVsPlayerModule];
