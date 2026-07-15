import { useDraftContributionPreference } from "hooks/useDraftContributionPreference";
import { useAuth } from "contexts/AuthProviderContext";

import styles from "./DraftRanker.module.scss";

export function DraftContributionConsent() {
  const { user } = useAuth();
  const consent = useDraftContributionPreference(user?.id ?? "", Boolean(user));
  const preference = consent.state.data;

  return (
    <section
      className={styles.consentCard}
      aria-labelledby="draft-contribution-title"
    >
      <div>
        <p className={styles.eyebrow}>Private by default</p>
        <h2 id="draft-contribution-title">Community contribution</h2>
        <p>
          Your ranking and comparison history stay private. If you opt in, only
          your explicit, prompt-issued player choices may contribute anonymously
          to FHFH Community Rankings. Direct list edits, skips, and “too close”
          answers never become community wins.
        </p>
        <p>
          You can opt out at any time. Future community calculations will exclude
          your evidence, and FHFH never publishes your raw comparison history.
        </p>
      </div>
      {consent.state.isLoading ? (
        <p className={styles.consentStatus}>Loading contribution preference…</p>
      ) : consent.state.error ? (
        <div className={styles.consentStatus} role="alert">
          <p>We couldn’t load your contribution preference.</p>
          <button type="button" onClick={() => consent.state.refetch()}>
            Try again
          </button>
        </div>
      ) : (
        <label className={styles.consentToggle}>
          <input
            type="checkbox"
            checked={preference?.contributionEnabled ?? false}
            disabled={consent.mutation.isPending}
            onChange={(event) => consent.mutation.mutate(event.target.checked)}
          />
          <span>
            Contribute my explicit comparisons anonymously to FHFH Community
            Rankings.
          </span>
        </label>
      )}
      {consent.mutation.error ? (
        <p className={styles.error} role="alert">
          The contribution preference could not be saved. Your previous setting
          is unchanged.
        </p>
      ) : consent.mutation.isSuccess ? (
        <p className={styles.requestSuccess} role="status">
          Contribution preference saved.
        </p>
      ) : null}
    </section>
  );
}
