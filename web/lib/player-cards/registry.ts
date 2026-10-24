import type { MetricCategory, MetricDefinition, MetricId } from "./contracts";

export const REGISTRY_VERSION = "proposed-nst-v0" as const;
const define = (id: MetricId, label: string, help: string, category: MetricCategory, unit: string, numerator: string, denominator: string, formula: MetricDefinition["formula"], fieldMapping: string, precision = 2): MetricDefinition => ({
  id, label, help, category, unit, numerator, denominator, formula, fieldMapping, precision,
  provider: "NST", toiUnit: "seconds", strength: "selected", seasonType: "regular",
  validity: "Complete matching game/strength inputs; finite nonnegative components; positive ratio denominator. A valid zero is retained.",
  universe: "provider-definition-unverified", entitlement: "allocation-pending",
});
export const METRICS: readonly MetricDefinition[] = [
  define("atoi", "ATOI", "Time on ice per NHL appearance", "Opportunity", "min/GP", "individual.toi", "NHL appearances", "atoi", "counts.toi / official GP"),
  define("sog60", "SOG/60", "Individual shots on goal per 60 minutes", "Individual generation", "shots/60", "individual.shots", "individual.toi", "per60", "counts.shots, counts.toi"),
  define("icf60", "iCF/60", "Individual shot attempts per 60 minutes", "Individual generation", "attempts/60", "individual.icf", "individual.toi", "per60", "counts.icf, counts.toi"),
  define("iscf60", "iSCF/60", "Individual scoring chances per 60 minutes", "Individual generation", "chances/60", "individual.iscfs", "individual.toi", "per60", "counts.iscfs, counts.toi"),
  define("ixg60", "ixG/60", "Individual expected goals per 60 minutes", "Individual generation", "xG/60", "individual.ixg", "individual.toi", "per60", "counts.ixg, counts.toi"),
  define("cf60", "On-ice CF/60", "Team shot attempts while on ice", "On-ice context", "attempts/60", "onIce.cf", "onIce.toi", "per60", "counts_oi.cf, counts_oi.toi"),
  define("scf60", "On-ice SCF/60", "Team scoring chances while on ice", "On-ice context", "chances/60", "onIce.scf", "onIce.toi", "per60", "counts_oi.scf, counts_oi.toi"),
  define("xgf60", "On-ice xGF/60", "Team expected goals for while on ice", "On-ice context", "xG/60", "onIce.xgf", "onIce.toi", "per60", "counts_oi.xgf, counts_oi.toi"),
  define("xgPct", "On-ice xG%", "Share of expected goals for while on ice", "On-ice context", "%", "onIce.xgf", "onIce.xgf + onIce.xga", "percentage", "counts_oi.xgf, counts_oi.xga", 1),
  define("ipp", "IPP", "Share of on-ice goals involving a player point", "Finishing & involvement", "%", "individual.total_points", "onIce.gf", "percentage", "counts.total_points, counts_oi.gf", 1),
  define("shPct", "SH%", "Individual goals divided by shots on goal", "Finishing & involvement", "%", "individual.goals", "individual.shots", "percentage", "counts.goals, counts.shots", 1),
  define("oiShPct", "On-ice SH%", "On-ice goals for divided by shots for", "Finishing & involvement", "%", "onIce.gf", "onIce.sf", "percentage", "counts_oi.gf, counts_oi.sf", 1),
];
export const CATEGORIES: readonly MetricCategory[] = ["Opportunity", "Individual generation", "On-ice context", "Finishing & involvement"];
export const CURATED_METRICS: readonly MetricId[] = ["atoi", "sog60", "iscf60", "ixg60", "xgf60", "xgPct", "shPct", "ipp"];
export const EXTRA_METRICS: readonly MetricId[] = ["atoi", "icf60", "iscf60", "ixg60", "cf60", "scf60", "oiShPct", "ipp"];

