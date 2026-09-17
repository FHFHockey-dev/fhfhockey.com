import supabase from "lib/supabase/client";
import { leagueOf } from "./contracts";
import type { Contribution } from "./storage";

export async function mockRequest(
  path: string,
  method: string,
  body?: unknown,
  expectedUser?: string | null,
) {
  const { data } = await supabase.auth.getSession();
  if (!data.session || (expectedUser && data.session.user.id !== expectedUser))
    throw new Error(
      "Sign in with the account that started this mock to sync contributions.",
    );
  const response = await fetch(`/api/v1/mock-draft/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(
        result.error?.message ??
          "Mock service unavailable. Practice can continue.",
      ),
      { status: response.status },
    );
  return result.data;
}
export async function syncContributions(session: Contribution) {
  if (!session.contributor) return;
  if (session.withdrawn) {
    try {
      await mockRequest(
        `sessions/${session.id}/contributions`,
        "DELETE",
        undefined,
        session.contributor,
      );
    } catch (e) {
      if ((e as { status?: number }).status !== 404) throw e;
    }
    return;
  }
  // Registration retries carry no projection, research, or queue payloads.
  const registration = await mockRequest(
    "sessions",
    "POST",
    {
      id: session.id,
      league: leagueOf(session.config),
      userSeat: session.config.userSeat,
      tier: session.config.tier,
      engineVersion: session.engineVersion,
      researchVersion: session.researchVersion,
    },
    session.contributor,
  );
  if (registration.withdrawn) return;
  for (let start = 0; start < session.picks.length; start += 100) {
    const events = session.picks
      .slice(start, start + 100)
      .map(({ reasons, ...event }) => event);
    await mockRequest(
      `sessions/${session.id}/events`,
      "POST",
      {
        events,
        complete:
          session.status === "complete" && start + 100 >= session.picks.length,
      },
      session.contributor,
    );
  }
}
