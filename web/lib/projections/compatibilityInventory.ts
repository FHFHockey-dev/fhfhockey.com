export type ForgeCompatibilityInventory = {
  version: "forge-compatibility-inventory-v2";
  removedShim: {
    legacyModulePath: string;
    canonicalModulePath: string;
    status: "removed";
    note: string;
  };
  duplicateReaders: Array<{
    canonicalRoute: string;
    legacyRoute: string;
    status: "deprecated_readable";
  }>;
  transitionalRoutes: Array<{
    route: string;
    status: "transitional" | "canonical";
    note: string;
  }>;
  retiredRoutes: Array<{
    route: string;
    status: "retired";
    note: string;
  }>;
};

export const FORGE_COMPATIBILITY_INVENTORY: ForgeCompatibilityInventory = {
  version: "forge-compatibility-inventory-v2",
  removedShim: {
    legacyModulePath: "web/lib/projections/runProjectionV2.ts",
    canonicalModulePath: "web/lib/projections/run-forge-projections.ts",
    status: "removed",
    note:
      "All surviving projection execution imports should resolve through run-forge-projections.ts."
  },
  duplicateReaders: [
    {
      canonicalRoute: "/api/v1/forge/players",
      legacyRoute: "/api/v1/projections/players",
      status: "deprecated_readable"
    },
    {
      canonicalRoute: "/api/v1/forge/goalies",
      legacyRoute: "/api/v1/projections/goalies",
      status: "deprecated_readable"
    }
  ],
  transitionalRoutes: [
    {
      route: "/api/v1/db/update-goalie-projections-v2",
      status: "canonical",
      note: "Canonical goalie-start writer after legacy writer quarantine."
    }
  ],
  retiredRoutes: [
    {
      route: "/api/v1/db/update-start-chart-projections",
      status: "retired",
      note:
        "Retired after Start Chart and other live readers moved to canonical forge_player_projections."
    }
  ]
};

export function buildCanonicalReaderCompatibility(args: {
  canonicalRoute: string;
  legacyRoute: string;
}) {
  return {
    inventoryVersion: FORGE_COMPATIBILITY_INVENTORY.version,
    canonicalRoute: args.canonicalRoute,
    legacyRoute: args.legacyRoute,
    status: "canonical_preferred" as const,
    note: "Legacy namespace remains readable only for compatibility."
  };
}

export function buildStartChartCompatibility() {
  return {
    inventoryVersion: FORGE_COMPATIBILITY_INVENTORY.version,
    canonicalSkaterSource: "forge_player_projections",
    canonicalReadRoute: "/api/v1/start-chart",
    retiredLegacyMaterializerRoute: "/api/v1/db/update-start-chart-projections",
    legacyMaterializerRemoved: true,
    legacyPlayerProjectionsReadDisabled: true,
    note:
      "Start Chart reads forge_player_projections directly; the legacy player_projections materializer route has been retired."
  };
}
