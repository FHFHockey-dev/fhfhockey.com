import { bshBoardModule } from "../bshBoard";
import { categoryBlueprintModule } from "../categoryBlueprint";
import type { AnyShareModule } from "../contract";
import { nightlyFloorModule } from "../nightlyFloor";

/** BSH, Category Blueprint, Nightly Floor (SS 3.0, 7.0). Owned by this lane alone; add its posts here. */
export const skaterBoardModules: readonly AnyShareModule[] = [bshBoardModule, categoryBlueprintModule, nightlyFloorModule];
