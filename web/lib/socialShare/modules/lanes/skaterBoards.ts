import { bshBoardModule } from "../bshBoard";
import { categoryBlueprintModule } from "../categoryBlueprint";
import type { AnyShareModule } from "../contract";
import { multiCatStarsModule } from "../multiCatStars";
import { nightlyFloorModule } from "../nightlyFloor";

/** BSH, Category Blueprint, Nightly Floor (SS 3.0, 7.0), Top Multi-Cat Stars. Owned by this lane alone; add its posts here. */
export const skaterBoardModules: readonly AnyShareModule[] = [bshBoardModule, categoryBlueprintModule, nightlyFloorModule, multiCatStarsModule];
