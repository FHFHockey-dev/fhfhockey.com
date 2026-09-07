import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";

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
  passInfo: { priceCents: number; expiresAt: string; renewal: "none" };
  checkoutAvailability: { available: boolean; reason: string };
  configurationReadiness: { stripe: boolean; patreon: boolean; yahoo: boolean };
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

function checkoutUnavailableReason(reason: string) {
  return ({ checkout_disabled: "Checkout is not available right now.", stripe_not_configured: "Checkout is not configured yet.", site_url_not_configured: "Checkout is not configured yet.", pass_expired: "This Draft Pro pass is no longer available.", already_eligible: "Draft Pro is already active for this account." } as Record<string, string>)[reason] ?? "Checkout is unavailable right now.";
}

export default function DraftProPanel() {
  const router = useRouter();
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
  const [checkoutState, setCheckoutState] = useState<"idle" | "waiting" | "confirming" | "confirmed" | "ineligible" | "cancelled">("idle");
  const [checkoutRetryAvailable, setCheckoutRetryAvailable] = useState(false);
  const checkoutVerificationRef = useRef<string | null>(null);
  const checkoutTimerRef = useRef<number | null>(null);
  const checkoutEpochRef = useRef(0);
  const accountEpochRef = useRef(0);
  const checkoutMountedRef = useRef(false);

  const selectedPurchase = useMemo(
    () => account?.purchases.find((purchase) => purchase.id === purchaseId) ?? account?.purchases[0] ?? null,
    [account?.purchases, purchaseId],
  );
  const loadAccount = useCallback(async (epoch = accountEpochRef.current) => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) throw new Error("Authentication required.");
    const response = await fetch("/api/v1/account/draft-pro", { headers: { Authorization: `Bearer ${session.access_token}` } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message ?? "Draft Pro account details are unavailable.");
    if (epoch !== accountEpochRef.current) return;
    setAccount(body.data);
    setPurchaseId((current) => current || body.data.purchases[0]?.id || "");
    setError(null);
  }, []);
  const cancelCheckoutVerification = useCallback(() => {
    checkoutEpochRef.current += 1;
    checkoutVerificationRef.current = null;
    if (checkoutTimerRef.current !== null) window.clearTimeout(checkoutTimerRef.current);
    checkoutTimerRef.current = null;
  }, []);
  useEffect(() => {
    checkoutMountedRef.current = true;
    return () => {
      checkoutMountedRef.current = false;
      cancelCheckoutVerification();
    };
  }, [cancelCheckoutVerification]);
  useEffect(() => {
    const listener = supabase.auth.onAuthStateChange?.((_event, session) => {
      accountEpochRef.current += 1;
      cancelCheckoutVerification();
      setCheckoutState("idle");
      setCheckoutRetryAvailable(false);
      setAccount(null);
      if (!session) {
        setError("Authentication required.");
        setLoading(false);
        return;
      }
      setLoading(true);
      void loadAccount(accountEpochRef.current).catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Draft Pro account details are unavailable.");
      }).finally(() => setLoading(false));
    });
    return () => listener?.data.subscription.unsubscribe();
  }, [cancelCheckoutVerification, loadAccount]);
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
    cancelCheckoutVerification();
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
      if (!response.ok) {
        throw new Error(body.error?.message ?? body.error ?? "Checkout could not be started.");
      }
      if (typeof body.url === "string") {
        window.location.assign(body.url);
        return;
      }
      if (body.state === "waiting" || body.state === "confirming") {
        setCheckoutState(body.state);
        setCheckoutRetryAvailable(true);
        setFeedback("Checkout is still open or confirming. Refresh your account access after completing payment.");
        setCheckoutLoading(false);
        return;
      }
      if (body.alreadyPurchased) {
        await loadAccount();
        setCheckoutLoading(false);
        return;
      }
      throw new Error("Checkout could not be started.");
    } catch (checkoutError) {
      setFeedback(checkoutError instanceof Error ? checkoutError.message : "Checkout could not be started.");
      setCheckoutLoading(false);
    }
  }

  const verifyCheckout = useCallback(async (sessionId: string, attempt = 0, epoch = checkoutEpochRef.current) => {
    const isCurrent = () => checkoutMountedRef.current && epoch === checkoutEpochRef.current;
    if (!isCurrent()) return;
    setCheckoutState(attempt ? "confirming" : "waiting");
    setCheckoutRetryAvailable(false);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!isCurrent()) return;
      if (!session?.access_token) throw new Error("Sign in to confirm your Draft Pro purchase.");
      const response = await fetch("/api/v1/account/draft-pro/checkout/verify", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!isCurrent()) return;
      if (!response.ok) throw new Error(body.error ?? "Checkout verification failed.");
      if (body.state === "confirmed") {
        setCheckoutState("confirmed");
        await loadAccount();
        return;
      }
      if ((body.state === "waiting" || body.state === "confirming") && attempt < 2) {
        setCheckoutState(body.state);
        checkoutTimerRef.current = window.setTimeout(() => void verifyCheckout(sessionId, attempt + 1, epoch), 750);
        return;
      }
      setCheckoutState(body.state === "ineligible" ? "ineligible" : body.state === "waiting" ? "waiting" : "confirming");
      setCheckoutRetryAvailable(body.state !== "ineligible");
    } catch (error) {
      if (!isCurrent()) return;
      setCheckoutState("confirming");
      setCheckoutRetryAvailable(true);
      setFeedback(error instanceof Error ? error.message : "Checkout verification failed. Check purchase status again.");
    }
  }, [loadAccount]);

  const clearCheckoutReturn = useCallback(() => {
    cancelCheckoutVerification();
    const { draft_pro_checkout: _checkout, ...query } = router.query;
    void router.replace?.({ pathname: router.pathname, query }, undefined, { shallow: true });
  }, [cancelCheckoutVerification, router]);

  useEffect(() => {
    const value = Array.isArray(router.query.draft_pro_checkout)
      ? router.query.draft_pro_checkout[0]
      : router.query.draft_pro_checkout;
    if (value === "cancelled") {
      clearCheckoutReturn();
      setCheckoutState("cancelled");
      return;
    }
    if (!value || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(value) || checkoutVerificationRef.current === value) return;
    cancelCheckoutVerification();
    checkoutVerificationRef.current = value;
    const { draft_pro_checkout: _checkout, ...query } = router.query;
    void router.replace?.({ pathname: router.pathname, query }, undefined, { shallow: true });
    void verifyCheckout(value, 0, checkoutEpochRef.current);
  }, [cancelCheckoutVerification, clearCheckoutReturn, router, verifyCheckout]);

  if (loading) return <section className={styles.panel} aria-busy="true"><h2>Draft Pro</h2><p>Loading account access…</p></section>;
  if (error) return <section className={styles.panel} role="alert"><h2>Draft Pro</h2><p>{error}</p></section>;
  if (!account) return null;

  const openRefundPurchaseIds = new Set(account.refundRequests.filter((request) => ["open", "reviewing"].includes(request.status)).map((request) => request.purchaseId));
  const canRequest = Boolean(selectedPurchase?.refundEligibility.eligible && !openRefundPurchaseIds.has(selectedPurchase.id));
  const checkoutAvailability = account.checkoutAvailability ?? { available: false, reason: "checkout_disabled" };
  const passInfo = account.passInfo ?? { priceCents: 599, expiresAt: "2027-07-01T04:00:00.000Z", renewal: "none" as const };
  return <section className={styles.panel} aria-labelledby="draft-pro-panel-title">
    <div className={styles.heading}><div><p className={styles.eyebrow}>Account access</p><h2 id="draft-pro-panel-title">Draft Pro</h2></div><span className={account.access.eligible ? styles.active : styles.inactive}>{account.access.eligible ? "Active" : "Inactive"}</span></div>
    <p className={styles.summary}>{account.access.eligible ? `Access from ${account.access.grantingSources.join(" and ")}.` : "Your retained Draft Pro work is locked while access is inactive."} No automatic renewal.</p>
    {checkoutState !== "idle" ? <div className={styles.notice} role="status"><p>{checkoutState === "waiting" ? "Checking payment status…" : checkoutState === "confirming" ? "Payment is confirming with Stripe." : checkoutState === "confirmed" ? "Draft Pro access is confirmed." : checkoutState === "cancelled" ? "Checkout was cancelled. Your free draft remains available." : "Your purchase could not be confirmed yet. Try refreshing this page or contact support if payment was completed."}</p>{checkoutRetryAvailable ? <div className={styles.actions}><button type="button" onClick={() => { const sessionId = checkoutVerificationRef.current; if (sessionId) { cancelCheckoutVerification(); void verifyCheckout(sessionId, 0, checkoutEpochRef.current); } else void loadAccount(); }}>Check purchase status again</button></div> : null}</div> : null}
    {!account.access.eligible ? <div className={styles.actions}>{checkoutAvailability.available ? <button type="button" onClick={() => void startCheckout()} disabled={checkoutLoading}>{checkoutLoading ? "Opening checkout…" : `Get Draft Pro — $${(passInfo.priceCents / 100).toFixed(2)} one-time`}</button> : <span className={styles.notice}>{checkoutUnavailableReason(checkoutAvailability.reason)}</span>}<span className={styles.notice}>One-time access through {formatEasternDate(passInfo.expiresAt)} (Eastern). No automatic renewal.</span></div> : null}
    <dl className={styles.details}><div><dt>Access expires</dt><dd>{formatEasternDate(account.access.expiresAt)} (Eastern)</dd></div><div><dt>Verified</dt><dd>{formatDate(account.access.verifiedAt)}</dd></div><div><dt>Patreon status</dt><dd>{account.access.grantingSources.includes("patreon") ? "Granting access" : "Not granting access"}</dd></div></dl>
    <div className={styles.actions}><button type="button" onClick={() => void patreonActionRequest("refresh")} disabled={Boolean(patreonAction)}>{patreonAction === "refresh" ? "Refreshing…" : "Refresh Patreon"}</button><button type="button" onClick={() => void patreonActionRequest("connect")} disabled={Boolean(patreonAction)}>{patreonAction === "connect" ? "Opening…" : "Connect Patreon"}</button></div>
    {account.purchases.length > 0 ? <div className={styles.purchaseList}><h3>Purchases</h3>{account.purchases.map((purchase) => { const request = account.refundRequests.find((item) => item.purchaseId === purchase.id); return <div className={styles.purchase} key={purchase.id}><div><strong>${(purchase.amountCents / 100).toFixed(2)} one-time pass</strong><span>{purchase.status} · activated {formatDate(purchase.activatedAt)}{request ? ` · refund request ${request.status}` : ""}</span></div>{purchase.receiptUrl ? <a href={purchase.receiptUrl} target="_blank" rel="noreferrer">Receipt</a> : <span className={styles.muted}>Receipt unavailable</span>}</div>; })}</div> : null}
    {account.savedDrafts.length > 0 ? <div className={styles.savedItems}><h3>Saved work</h3>{account.savedDrafts.map((draft) => <div key={draft.id}><span>{draft.name}</span><span>{draft.status}</span></div>)}</div> : null}
    {selectedPurchase ? <div className={styles.refundSection}><label>Purchase<select value={purchaseId} onChange={(event) => setPurchaseId(event.target.value)}>{account.purchases.map((purchase) => <option key={purchase.id} value={purchase.id}>${(purchase.amountCents / 100).toFixed(2)} · {formatDate(purchase.activatedAt)} · {purchase.refundEligibility.reason}</option>)}</select></label>{canRequest ? <form className={styles.form} onSubmit={submitRefund}><h3>Request a refund review</h3><p>Requests are reviewed case by case. Submit within 168 hours of activation; sending a request does not automatically refund or revoke access.</p><label>Reason<select value={reason} onChange={(event) => setReason(event.target.value as typeof reason)}>{reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Explanation <span>(10–2000 characters)</span><textarea minLength={10} maxLength={2000} required value={explanation} onChange={(event) => setExplanation(event.target.value)} /></label><label>What could improve this? <span>(optional)</span><textarea maxLength={2000} value={improvementNotes} onChange={(event) => setImprovementNotes(event.target.value)} /></label><label>Used during a live draft? <select value={usedDuringLiveDraft} onChange={(event) => setUsedDuringLiveDraft(event.target.value)}><option value="">Prefer not to say</option><option value="yes">Yes</option><option value="no">No</option></select></label><button type="submit" disabled={submitting}>{submitting ? "Submitting…" : "Submit request"}</button>{feedback ? <p role="status">{feedback}</p> : null}</form> : <p className={styles.notice}>Refund eligibility: {selectedPurchase.refundEligibility.reason}. {selectedPurchase.refundEligibility.deadline ? `The request window ended ${formatEasternDate(selectedPurchase.refundEligibility.deadline)} Eastern.` : "Patreon refunds are handled by Patreon."}</p>}</div> : null}
    {feedback && !canRequest ? <p role="status">{feedback}</p> : null}
  </section>;
}
