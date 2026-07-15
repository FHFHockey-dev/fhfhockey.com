import supabase from "lib/supabase/client";

export type DraftRankerClientErrorBody = {
  code: string;
  message: string;
  requestId?: string;
  details?: Record<string, unknown>;
};

export class DraftRankerClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: DraftRankerClientErrorBody,
  ) {
    super(body.message);
    this.name = "DraftRankerClientError";
  }
}

export async function draftRankerRequest<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new DraftRankerClientError(401, {
      code: "authentication_required",
      message: "Sign in to access your personal draft ranking.",
    });
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const body = payload?.error ?? {
      code: "internal_error",
      message: "The Draft Ranker request could not be completed.",
    };
    throw new DraftRankerClientError(response.status, body);
  }
  return payload.data as T;
}
