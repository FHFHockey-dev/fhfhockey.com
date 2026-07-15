import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

import supabase from "lib/supabase/client";
import type { Database, Json } from "lib/supabase/database-generated.types";

import styles from "./AccountSettingsPage.module.scss";

type ConnectedAccount =
  Database["public"]["Tables"]["connected_accounts"]["Row"];
type UserEntitlement = Database["public"]["Tables"]["user_entitlements"]["Row"];
type ProviderSyncRun =
  Database["public"]["Tables"]["provider_sync_runs"]["Row"];

type PatreonState = {
  configured: boolean;
  account: ConnectedAccount | null;
  entitlement: UserEntitlement | null;
  latestRun: ProviderSyncRun | null;
};

type Feedback = { tone: "error" | "success" | "info"; message: string };

function isJsonObject(
  value: Json | null | undefined,
): value is Record<string, Json> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Not yet synced";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown"
    : date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function tierLabels(entitlement: UserEntitlement | null) {
  if (!isJsonObject(entitlement?.metadata)) return [];
  const tiers = entitlement.metadata.tiers;
  if (!Array.isArray(tiers)) return [];
  return tiers.flatMap((tier) => {
    if (!isJsonObject(tier)) return [];
    return typeof tier.title === "string" && tier.title.trim()
      ? [tier.title.trim()]
      : typeof tier.id === "string"
        ? [`Tier ${tier.id}`]
        : [];
  });
}

async function readResponse(response: Response) {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

async function accessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error(
      "Your session expired. Sign in again before connecting Patreon.",
    );
  }
  return session.access_token;
}

export default function PatreonConnectionPanel() {
  const router = useRouter();
  const [state, setState] = useState<PatreonState | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<
    "connect" | "refresh" | "disconnect" | null
  >(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const loadState = useCallback(async () => {
    setLoading(true);
    try {
      const token = await accessToken();
      const response = await fetch("/api/v1/account/patreon", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await readResponse(response);
      if (!response.ok) {
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Patreon state could not be loaded.",
        );
      }
      setState(body as unknown as PatreonState);
    } catch (error) {
      setState(null);
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Patreon state could not be loaded.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    const status = Array.isArray(router.query.patreon_status)
      ? router.query.patreon_status[0]
      : router.query.patreon_status;
    const message = Array.isArray(router.query.patreon_message)
      ? router.query.patreon_message[0]
      : router.query.patreon_message;
    if (!status) return;
    setFeedback({
      tone: status === "error" ? "error" : "success",
      message:
        message ||
        (status === "connected"
          ? "Patreon connected."
          : status === "disconnected"
            ? "Patreon disconnected."
            : "Patreon connection could not be completed."),
    });
  }, [router.query.patreon_message, router.query.patreon_status]);

  const tiers = useMemo(() => tierLabels(state?.entitlement || null), [state]);
  const refreshBlocked = Boolean(
    state?.latestRun &&
    (state.latestRun.status === "running" ||
      state.latestRun.status === "queued" ||
      (state.latestRun.cooldown_until &&
        new Date(state.latestRun.cooldown_until).getTime() > Date.now())),
  );

  async function connect() {
    setAction("connect");
    setFeedback(null);
    try {
      const token = await accessToken();
      const response = await fetch("/api/v1/account/patreon/connect", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ next: "/account?section=patreon" }),
      });
      const body = await readResponse(response);
      if (!response.ok || typeof body.authorizationUrl !== "string") {
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Patreon authorization could not be started.",
        );
      }
      window.location.assign(body.authorizationUrl);
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Patreon authorization could not be started.",
      });
      setAction(null);
    }
  }

  async function refresh() {
    setAction("refresh");
    setFeedback(null);
    try {
      const token = await accessToken();
      const response = await fetch("/api/v1/account/patreon/refresh", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await readResponse(response);
      if (!response.ok) {
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Patreon membership could not be refreshed.",
        );
      }
      setFeedback({
        tone: "success",
        message: `Patreon membership refreshed; generic supporter eligibility is ${body.entitlementStatus === "active" ? "active" : "inactive"}.`,
      });
      await loadState();
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Patreon membership could not be refreshed.",
      });
    } finally {
      setAction(null);
    }
  }

  async function disconnect() {
    if (
      !window.confirm(
        "Disconnect Patreon and remove its local entitlement state?",
      )
    ) {
      return;
    }
    setAction("disconnect");
    setFeedback(null);
    try {
      const token = await accessToken();
      const response = await fetch("/api/v1/account/patreon/disconnect", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await readResponse(response);
      if (!response.ok) {
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Patreon could not be disconnected.",
        );
      }
      setFeedback({
        tone: "success",
        message:
          typeof body.message === "string"
            ? body.message
            : "Patreon disconnected.",
      });
      await loadState();
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Patreon could not be disconnected.",
      });
    } finally {
      setAction(null);
    }
  }

  return (
    <div
      className={styles.providerControlCard}
      aria-labelledby="patreon-link-title"
    >
      <div className={styles.formSectionHeader}>
        <h3 id="patreon-link-title" className={styles.formSectionTitle}>
          Patreon Membership Link
        </h3>
        <p className={styles.formSectionBody}>
          Link Patreon only to evaluate the configured FHFH campaign membership.
          It remains separate from your FHFH sign-in, and no matching email is
          required.
        </p>
      </div>

      {feedback ? (
        <div
          className={
            feedback.tone === "error"
              ? styles.errorMessage
              : feedback.tone === "success"
                ? styles.successMessage
                : styles.infoMessage
          }
          role={feedback.tone === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </div>
      ) : null}

      {loading ? (
        <div className={styles.profileLoading} aria-live="polite">
          Loading Patreon membership…
        </div>
      ) : (
        <div className={styles.providerControlRows}>
          <div className={styles.providerControlRow}>
            Connection: {state?.account ? "Linked" : "Not linked"}
          </div>
          <div className={styles.providerControlRow}>
            Generic supporter eligibility:{" "}
            {state?.entitlement?.entitlement_status || "None"}
          </div>
          <div className={styles.providerControlRow}>
            Patreon membership status:{" "}
            {state?.account?.metadata &&
            isJsonObject(state.account.metadata) &&
            typeof state.account.metadata.patron_status === "string"
              ? state.account.metadata.patron_status
              : "Unavailable"}
          </div>
          <div className={styles.providerControlRow}>
            Entitled tier{tiers.length === 1 ? "" : "s"}:{" "}
            {tiers.length ? tiers.join(", ") : "None reported"}
          </div>
          <div className={styles.providerControlRow}>
            Last sync: {formatTimestamp(state?.account?.last_synced_at)}
            {state?.latestRun ? ` · ${state.latestRun.status}` : ""}
          </div>
          <div className={styles.providerControlRow}>
            Tier-specific FHFH feature mapping: not configured; no concrete paid
            feature is granted by this local foundation.
          </div>
        </div>
      )}

      {!state?.configured && !state?.account && !loading ? (
        <div className={styles.infoMessage} role="status">
          Patreon OAuth is not configured in this environment. Live client and
          campaign settings remain a separate production checkpoint.
        </div>
      ) : null}

      <div className={styles.cardActionRow}>
        {!state?.account ? (
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => void connect()}
            disabled={loading || action !== null || !state?.configured}
          >
            {action === "connect" ? "Opening Patreon…" : "Connect Patreon"}
          </button>
        ) : (
          <>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => void refresh()}
              disabled={action !== null || refreshBlocked}
            >
              {action === "refresh"
                ? "Refreshing Patreon…"
                : refreshBlocked
                  ? "Patreon Refresh Cooling Down"
                  : "Refresh Patreon Membership"}
            </button>
            <button
              type="button"
              className={styles.dangerButton}
              onClick={() => void disconnect()}
              disabled={action !== null}
            >
              {action === "disconnect"
                ? "Disconnecting…"
                : "Disconnect Patreon"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
