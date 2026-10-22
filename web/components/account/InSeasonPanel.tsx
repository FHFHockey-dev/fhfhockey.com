import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useProviderSyncAccess } from "hooks/useProviderSyncAccess";
import supabase from "lib/supabase/client";

type Subscription = { subscriptionId: string; cancelledAt: string | null; billingStoppedAt: string | null; stopComplete: boolean };

export default function InSeasonPanel() {
  const { status, access, refresh } = useProviderSyncAccess();
  const [available, setAvailable] = useState(false);
  const [monthlyAvailable, setMonthlyAvailable] = useState(false);
  const [monthlyReason, setMonthlyReason] = useState("disabled");
  const [initialAmount, setInitialAmount] = useState<number | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[] | null>(null);
  const [managementError, setManagementError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const epoch = useRef(0);
  const cancellationIds = useRef<Record<string, string>>({});
  const cancellationOwnerId = useRef<string | null>(null);
  const invalidate = useCallback(() => { epoch.current++; }, []);
  const loadManagement = useCallback(async (requestEpoch: number) => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (requestEpoch !== epoch.current || !session) return;
      const response = await fetch("/api/v1/account/in-season/subscriptions", { headers: { Authorization: `Bearer ${session.access_token}` } });
      const body = await response.json();
      if (requestEpoch !== epoch.current) return;
      if (!response.ok || !Array.isArray(body?.data?.subscriptions)) throw new Error("Billing details could not be loaded. Please try again.");
      setSubscriptions(body.data.subscriptions); setManagementError(null);
    } catch { if (requestEpoch === epoch.current) setManagementError("Billing details could not be loaded. Please try again."); }
  }, []);
  const reload = useCallback(async () => {
    const requestEpoch = epoch.current;
    try {
      const response = await fetch("/api/v1/account/in-season/checkout");
      const body = await response.json();
      if (requestEpoch !== epoch.current) return;
      if (!response.ok) throw new Error("Unavailable");
      setAvailable(body?.data?.seasonPassAvailable === true);
      setMonthlyAvailable(body?.data?.monthlyAvailable === true);
      setMonthlyReason(body?.data?.monthlyReason ?? "disabled");
      setInitialAmount(Number.isSafeInteger(body?.data?.initialMonthlyAmountCents) ? body.data.initialMonthlyAmountCents : null);
      if (body?.data?.managementAvailable === true) await loadManagement(requestEpoch);
      else { setSubscriptions(null); setManagementError(null); }
    } catch { if (requestEpoch === epoch.current) { setAvailable(false); setMonthlyAvailable(false); setSubscriptions(null); setManagementError("Billing availability could not be checked. Please try again."); } }
  }, [loadManagement]);
  useEffect(() => {
    void reload();
    const listener = supabase.auth.onAuthStateChange((event, session) => {
      const ownerId = event === "SIGNED_OUT" ? null : session?.user?.id ?? null;
      // Refreshing this owner's token must not change an uncertain request's ID.
      if (!ownerId || ownerId !== cancellationOwnerId.current) cancellationIds.current = {};
      cancellationOwnerId.current = ownerId;
      invalidate(); setBusy(false); setMessage(null); setConfirming(null);
      setAvailable(false); setMonthlyAvailable(false); setSubscriptions(null); setManagementError(null);
      void reload();
    });
    return () => { invalidate(); listener.data.subscription.unsubscribe(); };
  }, [invalidate, reload]);

  async function checkout(plan: "season_pass" | "monthly") {
    const requestEpoch = epoch.current;
    setBusy(true); setMessage(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (requestEpoch !== epoch.current) return;
      if (!session) throw new Error("Sign in to choose premium access.");
      const response = await fetch("/api/v1/account/in-season/checkout", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
      const body = await response.json();
      if (requestEpoch !== epoch.current) return;
      if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : "Checkout is unavailable. Please try again.");
      if (body?.data?.url) {
        const url = new URL(body.data.url);
        const host = plan === "monthly" ? "invoice.stripe.com" : "checkout.stripe.com";
        if (url.protocol !== "https:" || url.hostname !== host || url.username || url.password || url.port) throw new Error("Checkout returned an invalid destination.");
        window.location.assign(url.href);
      } else {
        setMessage(body?.data?.state === "expired" ? "That checkout expired. You can try again." : "Checking payment confirmation. Access begins after payment is verified.");
        void refresh();
      }
    } catch (error) { if (requestEpoch === epoch.current) setMessage(error instanceof Error ? error.message : "Checkout is unavailable."); }
    finally { if (requestEpoch === epoch.current) setBusy(false); }
  }

  async function cancel(subscriptionId: string) {
    const requestEpoch = epoch.current;
    setBusy(true); setMessage(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (requestEpoch !== epoch.current) return;
      if (!session?.user?.id) throw new Error("Sign in to manage billing.");
      if (cancellationOwnerId.current !== session.user.id) cancellationIds.current = {};
      cancellationOwnerId.current = session.user.id;
      const requestId = cancellationIds.current[subscriptionId] ??= crypto.randomUUID();
      const response = await fetch("/api/v1/account/in-season/cancel", { method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ subscriptionId, requestId }) });
      const body = await response.json();
      if (requestEpoch !== epoch.current) return;
      if (!response.ok || body?.data?.accepted !== true) throw new Error(body?.error ?? "Cancellation could not be confirmed. Please try again.");
      setConfirming(null);
      setMessage("Cancellation saved. This subscription's access has ended. Check its billing stop status below. Your independent supporter access and saved plans remain unchanged.");
      void refresh(); await loadManagement(requestEpoch);
    } catch (error) { if (requestEpoch === epoch.current) setMessage(error instanceof Error ? error.message : "Cancellation could not be confirmed. Please try again."); }
    finally { if (requestEpoch === epoch.current) setBusy(false); }
  }

  return <section aria-labelledby="in-season-access-title">
    <h2 id="in-season-access-title">Premium sync access</h2>
    <p>Choose $4.99 monthly or a $24.99 one-time season pass. Both plans end July 1, 2027 at midnight New York time.</p>
    <p>Access covers supported Yahoo and Fantrax sync features. Manual tools and your saved local plans remain available. Fantrax support varies by tool.</p>
    {status === "idle" ? <p><Link href="/auth?mode=sign-in">Sign in to view your access</Link></p>
      : status === "loading" ? <p role="status">Checking your access…</p>
      : status === "error" ? <p role="alert">Your access could not be verified. <button type="button" onClick={() => void refresh()}>Try again</button></p>
      : access?.eligible ? <p role="status">Premium sync is active for your account. Your existing supporter and retained access still apply.</p>
      : access?.eligible === false ? <div>
        <h3>Season pass · $24.99</h3>
        <p>One payment for access until July 1, 2027. No automatic renewal.</p>
        <button type="button" disabled={!available || busy} onClick={() => void checkout("season_pass")}>Buy season pass · $24.99</button>
        {!available && <p>Season-pass checkout is not available yet.</p>}
        <h3>Monthly · $4.99</h3>
        <p>Monthly billing ends with the season, with no July charge or offseason renewal. Cancellation ends access immediately.</p>
        {monthlyAvailable && initialAmount !== null && <p>Estimated first charge: ${(initialAmount / 100).toFixed(2)}. Review the exact amount on Stripe before paying.</p>}
        <button type="button" disabled={!monthlyAvailable || busy} onClick={() => void checkout("monthly")}>{monthlyAvailable ? "Start monthly · $4.99" : "Monthly checkout coming soon"}</button>
        {monthlyReason === "below_verified_minimum" && <p>Monthly signup is temporarily unavailable because the first charge is below the payment minimum. We will not round it up or carry a balance.</p>}
        {monthlyReason === "season_ended" && <p>Monthly signup has closed for the season.</p>}
      </div> : null}
    {subscriptions && subscriptions.length > 0 && <section aria-label="Monthly billing management">
      <h3>Manage monthly billing</h3>
      {subscriptions.map((subscription, index) => <div key={subscription.subscriptionId}>
        <p>Monthly subscription {index + 1}</p>
        {subscription.cancelledAt || subscription.billingStoppedAt
          ? <p>{subscription.cancelledAt ? "This subscription's access has ended. " : "Billing stop requested. Payment-specific access is shown above. "}{subscription.stopComplete ? "Billing stop completed." : "Billing stop is pending."}</p>
          : <button type="button" disabled={busy} onClick={() => setConfirming(subscription.subscriptionId)}>Cancel monthly access</button>}
      </div>)}
    </section>}
    {confirming && <div role="alertdialog" aria-label="Confirm monthly cancellation">
      <p>Cancellation ends this subscription&apos;s access immediately. Refund requests are reviewed manually. Independent supporter access and saved plans remain available.</p>
      <button type="button" disabled={busy} onClick={() => void cancel(confirming)}>Confirm cancellation</button>
      <button type="button" disabled={busy} onClick={() => setConfirming(null)}>Keep monthly access</button>
    </div>}
    {managementError && <p role="alert">{managementError}</p>}
    {message && <p role="status">{message}</p>}
    <p><button type="button" disabled={busy} onClick={() => { void refresh(); void reload(); }}>Refresh access after payment</button></p>
  </section>;
}
