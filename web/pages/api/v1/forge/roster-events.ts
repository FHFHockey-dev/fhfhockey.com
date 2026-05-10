import type { NextApiResponse } from "next";

import adminOnly from "utils/adminOnlyMiddleware";

const EVENT_TYPES = new Set([
  "INJURY_OUT",
  "DTD",
  "RETURN",
  "CALLUP",
  "SENDDOWN",
  "LINE_CHANGE",
  "PP_UNIT_CHANGE",
  "GOALIE_START_CONFIRMED",
  "GOALIE_START_LIKELY"
]);

function firstParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value) && value[0]?.trim()) return value[0].trim();
  return null;
}

function parseBody(req: any): Record<string, unknown> {
  return typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
}

function finiteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildMutationPayload(body: Record<string, unknown>) {
  const eventType = typeof body.event_type === "string" ? body.event_type : null;
  if (!eventType || !EVENT_TYPES.has(eventType)) {
    throw new Error("Unsupported or missing event_type.");
  }
  const confidence = finiteNumber(body.confidence) ?? 0.5;
  if (confidence < 0 || confidence > 1) {
    throw new Error("confidence must be between 0 and 1.");
  }
  const teamId = finiteNumber(body.team_id);
  const playerId = finiteNumber(body.player_id);
  if (teamId == null && playerId == null) {
    throw new Error("team_id or player_id is required.");
  }
  return {
    team_id: teamId,
    player_id: playerId,
    event_type: eventType,
    confidence,
    effective_from:
      typeof body.effective_from === "string"
        ? body.effective_from
        : new Date().toISOString(),
    effective_to: typeof body.effective_to === "string" ? body.effective_to : null,
    payload:
      body.payload != null && typeof body.payload === "object"
        ? body.payload
        : {},
    source_text: typeof body.source_text === "string" ? body.source_text : null,
    updated_at: new Date().toISOString()
  };
}

export default adminOnly(async (req: any, res: NextApiResponse) => {
  try {
    if (req.method === "GET") {
      let query = req.supabase
        .from("forge_roster_events")
        .select("*")
        .order("effective_from", { ascending: false })
        .limit(Math.min(Math.max(finiteNumber(req.query.limit) ?? 100, 1), 500));
      const teamId = finiteNumber(firstParam(req.query.team_id));
      const playerId = finiteNumber(firstParam(req.query.player_id));
      if (teamId != null) query = query.eq("team_id", teamId);
      if (playerId != null) query = query.eq("player_id", playerId);
      const { data, error } = await query;
      if (error) throw error;
      return res.json({ success: true, data: data ?? [] });
    }

    if (req.method === "POST") {
      const payload = buildMutationPayload(parseBody(req));
      const { data, error } = await req.supabase
        .from("forge_roster_events")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      return res.status(201).json({ success: true, data });
    }

    if (req.method === "PATCH") {
      const body = parseBody(req);
      const eventId = finiteNumber(body.event_id ?? req.query.event_id);
      if (eventId == null) {
        return res.status(400).json({ success: false, message: "event_id is required." });
      }
      const payload = buildMutationPayload(body);
      const { data, error } = await req.supabase
        .from("forge_roster_events")
        .update(payload)
        .eq("event_id", eventId)
        .select("*")
        .single();
      if (error) throw error;
      return res.json({ success: true, data });
    }

    if (req.method === "DELETE") {
      const eventId = finiteNumber(req.query.event_id ?? parseBody(req).event_id);
      if (eventId == null) {
        return res.status(400).json({ success: false, message: "event_id is required." });
      }
      const { error } = await req.supabase
        .from("forge_roster_events")
        .delete()
        .eq("event_id", eventId);
      if (error) throw error;
      return res.json({ success: true, deletedEventId: eventId });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return res.status(405).json({ success: false, message: "Method not allowed." });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error?.message ?? String(error)
    });
  }
});
