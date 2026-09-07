import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import supabase from "lib/supabase/client";

import styles from "./DraftProPanel.module.scss";

type AccountData = {
  access: {
    eligible: boolean;
    grantingSources: string[];
    expiresAt: string | null;
    verifiedAt: string | null;
    reason: string;
    providerReadiness: Record<string, boolean>;
  };
  purchases: Array<{
    id: string;
    season: string;
    status: string;
    activatedAt: string | null;
    expiresAt: string | null;
    amountCents: number;
    currency: string;
    receiptUrl: string | null;
    refundEligibility: { eligible: boolean; deadline: string | null; reason: string };
  }>;
  refundRequests: Array<{ id: string; purchaseId: string; reason: string; status: string; submittedAt: string; emailStatus: string }>;
  savedDrafts: Array<{ id: string; name: string; status: string; updatedAt: string }>;
  privateImports: Array<{ id: string; name: string; draftId: string | null; byteSize: number; updatedAt: string }>;
};

const reasons = [
  ["accidental_purchase", "Accidental purchase"],
  ["technical_issue", "Technical issue"],
  ["missing_feature", "Missing feature"],
  ["confusing_experience", "Confusing experience"],
  ["not_useful_for_my_draft", "Not useful for my draft"],
  ["other", "Other"],
] as const;

function formatDate(value: string | null) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleDateString();
}

function formatEasternDate(value: string | null) {
  if (!value) return "Unavailable";
  const date = new Date(new Date(value).getTime() - 1);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric" });
}

export default function DraftProPanel() {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchaseId, setPurchaseId] = useState("");
  const [reason, setReason] = useState<(typeof reasons)[number][0]>("other");
  const [explanation, setExplanation] = useState("");
  const [improvementNotes, setImprovementNotes] = useState("");
  const [usedDuringLiveDraft, setUsedDuringLiveDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [patreonAction, setPatreonAction] = useState<"refresh" | "connect" | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const selectedPurchase = useMemo(
    () => account?.purchases.find((purchase) => purchase.id === purchaseId) ?? account?.purchases[0] ?? null,
    [account?.purchases, purchaseId],
  );
  const loadAccount = useCallback(async () => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) throw new Error("Authentication required.");
    const response = await fetch("/api/v1/account/draft-pro", { headers: { Authorization: `Bearer ${session.access_token}` } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message ?? "Draft Pro account details are unavailable.");
    setAccount(body.data);
    setPurchaseId((current) => current || body.data.purchases[0]?.id || "");
    setError(null);
  }, []);
  useEffect(() => {
    let cancelled = false;
    void loadAccount().catch((loadError) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Draft Pro account details are unavailable.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [loadAccount]);

  async function submitRefund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error("Authentication required.");
      const response = await fetch("/api/v1/account/draft-pro/refund-requests", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId: selectedPurchase?.id, reason, explanation, improvementNotes: improvementNotes || undefined, usedDuringLiveDraft: usedDuringLiveDraft === "" ? undefined : usedDuringLiveDraft === "yes" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Refund request could not be submitted.");
      setFeedback("Your request was submitted for case-by-case review. It does not automatically refund or revoke access.");
      setExplanation("");
      setImprovementNotes("");
      setAccount((current) => current ? { ...current, refundRequests: [...current.refundRequests, { ...body.data, purchaseId: selectedPurchase?.id ?? "" }] } : current);
    } catch (submitError) {
      setFeedback(submitError instanceof Error ? submitError.message : "Refund request could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  async function patreonActionRequest(action: "refresh" | "connect") {
    setPatreonAction(action);
    setFeedback(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error("Authentication required.");
      const response = await fetch(action === "refresh" ? "/api/v1/account/patreon/refresh" : "/api/v1/account/patreon/connect", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: action === "connect" ? JSON.stringify({ next: "/account?section=patreon" }) : undefined,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Patreon action failed.");
      if (action === "connect" && typeof body.authorizationUrl === "string") window.location.assign(body.authorizationUrl);
      else {
        await loadAccount();
        setFeedback("Patreon membership refreshed.");
      }
    } catch (actionError) {
      setFeedback(action === "refresh" ? "Patreon verification is unavailable. Try again later." : actionError instanceof Error ? actionError.message : "Patreon action failed.");
    } finally {
      setPatreonAction(null);
    }
  }

  async function startCheckout() {
    setCheckoutLoading(true);
    setFeedback(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) throw new Error("Sign in before purchasing Draft Pro.");
      const response = await fetch("/api/v1/account/draft-pro/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || typeof body.url !== "string") {
        throw new Error(body.error?.message ?? body.error ?? "Checkout could not be started.");
      }
      window.location.assign(body.url);
    } catch (checkoutError) {
      setFeedback(checkoutError instanceof Error ? checkoutError.message : "Checkout could not be started.");
      setCheckoutLoading(false);
    }
  }

  if (loading) return <section className={styles.panel} aria-busy="true"><h2>Draft Pro</h2><p>Loading account access…</p></section>;
  if (error) return <section className={styles.panel} role="alert"><h2>Draft Pro</h2><p>{error}</p></section>;
  if (!account) return null;

  const openRefundPurchaseIds = new Set(account.refundRequests.filter((request) => ["open", "reviewing"].includes(request.status)).map((request) => request.purchaseId));
  const canRequest = Boolean(selectedPurchase?.refundEligibility.eligible && !openRefundPurchaseIds.has(selectedPurchase.id));
  return <section className={styles.panel} aria-labelledby="draft-pro-panel-title">
    <div className={styles.heading}><div><p className={styles.eyebrow}>Account access</p><h2 id="draft-pro-panel-title">Draft Pro</h2></div><span className={account.access.eligible ? styles.active : styles.inactive}>{account.access.eligible ? "Active" : "Inactive"}</span></div>
    <p className={styles.summary}>{account.access.eligible ? `Access from ${account.access.grantingSources.join(" and ")}.` : "Your retained Draft Pro work is locked while access is inactive."} No automatic renewal.</p>
    {!account.access.eligible ? <div className={styles.actions}><button type="button" onClick={() => void startCheckout()} disabled={checkoutLoading}>{checkoutLoading ? "Opening checkout…" : "Get Draft Pro — $5.99 one-time"}</button><span className={styles.notice}>One-time access through June 30, 2027 (Eastern). No automatic renewal.</span></div> : null}
    <dl className={styles.details}><div><dt>Access expires</dt><dd>{formatEasternDate(account.access.expiresAt)} (Eastern)</dd></div><div><dt>Verified</dt><dd>{formatDate(account.access.verifiedAt)}</dd></div><div><dt>Patreon status</dt><dd>{account.access.grantingSources.includes("patreon") ? "Granting access" : "Not granting access"}</dd></div></dl>
    <div className={styles.actions}><button type="button" onClick={() => void patreonActionRequest("refresh")} disabled={Boolean(patreonAction)}>{patreonAction === "refresh" ? "Refreshing…" : "Refresh Patreon"}</button><button type="button" onClick={() => void patreonActionRequest("connect")} disabled={Boolean(patreonAction)}>{patreonAction === "connect" ? "Opening…" : "Connect Patreon"}</button></div>
    {account.purchases.length > 0 ? <div className={styles.purchaseList}><h3>Purchases</h3>{account.purchases.map((purchase) => { const request = account.refundRequests.find((item) => item.purchaseId === purchase.id); return <div className={styles.purchase} key={purchase.id}><div><strong>${(purchase.amountCents / 100).toFixed(2)} one-time pass</strong><span>{purchase.status} · activated {formatDate(purchase.activatedAt)}{request ? ` · refund request ${request.status}` : ""}</span></div>{purchase.receiptUrl ? <a href={purchase.receiptUrl} target="_blank" rel="noreferrer">Receipt</a> : <span className={styles.muted}>Receipt unavailable</span>}</div>; })}</div> : null}
    {account.savedDrafts.length > 0 ? <div className={styles.savedItems}><h3>Saved work</h3>{account.savedDrafts.map((draft) => <div key={draft.id}><span>{draft.name}</span><span>{draft.status}</span></div>)}</div> : null}
    {selectedPurchase ? <div className={styles.refundSection}><label>Purchase<select value={purchaseId} onChange={(event) => setPurchaseId(event.target.value)}>{account.purchases.map((purchase) => <option key={purchase.id} value={purchase.id}>${(purchase.amountCents / 100).toFixed(2)} · {formatDate(purchase.activatedAt)} · {purchase.refundEligibility.reason}</option>)}</select></label>{canRequest ? <form className={styles.form} onSubmit={submitRefund}><h3>Request a refund review</h3><p>Requests are reviewed case by case. Submit within 168 hours of activation; sending a request does not automatically refund or revoke access.</p><label>Reason<select value={reason} onChange={(event) => setReason(event.target.value as typeof reason)}>{reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Explanation <span>(10–2000 characters)</span><textarea minLength={10} maxLength={2000} required value={explanation} onChange={(event) => setExplanation(event.target.value)} /></label><label>What could improve this? <span>(optional)</span><textarea maxLength={2000} value={improvementNotes} onChange={(event) => setImprovementNotes(event.target.value)} /></label><label>Used during a live draft? <select value={usedDuringLiveDraft} onChange={(event) => setUsedDuringLiveDraft(event.target.value)}><option value="">Prefer not to say</option><option value="yes">Yes</option><option value="no">No</option></select></label><button type="submit" disabled={submitting}>{submitting ? "Submitting…" : "Submit request"}</button>{feedback ? <p role="status">{feedback}</p> : null}</form> : <p className={styles.notice}>Refund eligibility: {selectedPurchase.refundEligibility.reason}. {selectedPurchase.refundEligibility.deadline ? `The request window ended ${formatEasternDate(selectedPurchase.refundEligibility.deadline)} Eastern.` : "Patreon refunds are handled by Patreon."}</p>}</div> : null}
    {feedback && !canRequest ? <p role="status">{feedback}</p> : null}
  </section>;
}
