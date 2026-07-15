export type XgTrackingFrame = {
  gameId: number;
  eventId: number;
  eventType: string;
  frameIndex: number;
  frameTimestamp: number;
  trackingObjectId: string;
  playerId: number | null;
  teamId: number | null;
  x: number;
  y: number;
  isPuck: boolean;
};

export type XgTrackingAlignmentAudit = {
  frameRows: number;
  events: number;
  eventTypes: string[];
  playerIdentityCoverage: number | null;
  puckEventCoverage: number | null;
  issueCount: number;
  issues: string[];
  goalOnlyCoverage: boolean;
  trainingEligible: boolean;
};

export function auditXgTrackingAlignment(rows: XgTrackingFrame[]): XgTrackingAlignmentAudit {
  const issues = new Set<string>();
  const eventKeys = new Set<string>();
  const eventTypes = new Set<string>();
  const puckEvents = new Set<string>();
  const objectsByFrame = new Set<string>();
  let playerObjects = 0;
  let identifiedPlayers = 0;

  for (const row of rows) {
    const eventKey = `${row.gameId}:${row.eventId}`;
    const frameKey = `${eventKey}:${row.frameIndex}:${row.trackingObjectId}`;
    eventKeys.add(eventKey);
    eventTypes.add(row.eventType);
    if (objectsByFrame.has(frameKey)) issues.add(`Duplicate tracking object in frame ${frameKey}.`);
    objectsByFrame.add(frameKey);
    if (!Number.isFinite(row.frameTimestamp) || row.frameIndex < 0) issues.add(`Invalid frame ordering for ${eventKey}.`);
    if (!Number.isFinite(row.x) || !Number.isFinite(row.y) || Math.abs(row.x) > 110 || Math.abs(row.y) > 50) {
      issues.add(`Out-of-rink coordinate for ${frameKey}.`);
    }
    if (row.isPuck) puckEvents.add(eventKey);
    else {
      playerObjects += 1;
      if (row.playerId != null && row.teamId != null) identifiedPlayers += 1;
    }
  }
  const playerIdentityCoverage = playerObjects === 0 ? null : identifiedPlayers / playerObjects;
  const puckEventCoverage = eventKeys.size === 0 ? null : puckEvents.size / eventKeys.size;
  if (puckEventCoverage != null && puckEventCoverage < 1) issues.add("At least one event lacks a normalized puck object.");
  if (playerIdentityCoverage != null && playerIdentityCoverage < 0.95) issues.add("Player/team identity coverage is below 95%.");
  const goalOnlyCoverage = eventTypes.size > 0 && [...eventTypes].every((value) => value === "goal");
  if (goalOnlyCoverage) issues.add("Replay coverage is goal-only and cannot represent full-game tracking.");
  return {
    frameRows: rows.length,
    events: eventKeys.size,
    eventTypes: [...eventTypes].sort(),
    playerIdentityCoverage: playerIdentityCoverage == null ? null : Number(playerIdentityCoverage.toFixed(6)),
    puckEventCoverage: puckEventCoverage == null ? null : Number(puckEventCoverage.toFixed(6)),
    issueCount: issues.size,
    issues: [...issues].sort(),
    goalOnlyCoverage,
    trainingEligible: rows.length > 0 && issues.size === 0 && !goalOnlyCoverage,
  };
}

