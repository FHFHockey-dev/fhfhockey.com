import React from "react";
import type { ArmCPreview } from "lib/buyLowSellHigh/armCPreview.server";
import { EvidenceBlock } from "./BlshTradeComparison";
import styles from "./BlshTrade.module.scss";

const reviewReason: Record<string, string> = {
  reviewed_window_not_supplied: "A reviewed appearance list, game revisions and personal baseline are required for this cutoff.",
  invalid_selected_cutoff: "The selected cutoff is invalid.",
  candidate_target_mismatch: "The snapshot belongs to another skater or cutoff.",
  reviewed_export_incomplete: "The saved review is missing a required file.",
  reviewed_export_unreadable: "The saved review could not be verified.",
  no_unique_active_window_for_target: "There is no active independent review for this skater and cutoff.",
  original_game_evidence_unqualified: "A selected game is missing verified production, ice time or native observations.",
  latest_five_membership_changed: "The official appearance list has changed. The saved comparison needs a new window.",
  latest_official_appearance_stale: "The most recent official appearance was more than seven days before this check.",
  snapshot_or_recheck_stale_or_future: "The snapshot or its evidence check is outside the 24-hour review window.",
  reference_not_independently_accepted: "The personal history and model inputs still need an independent review.",
  saved_package_differs_from_verified_rebuild: "The saved comparison differs from the result rebuilt from its reviewed sources.",
  selected_source_revision_or_review_changed: "A selected observation or its review has changed.",
};

const iceTime = (seconds: number | null) => seconds === null ? "Unavailable"
  : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export default function ReviewedSkaterPreview({ preview }: { preview: ArmCPreview }) {
  return <section className={styles.container} aria-label="Five-game production review">
    <header>
      <h1 className={styles.title}>Five-game production review</h1>
      <p className={styles.subtitle}>Arm C compares five games with the skater’s earlier production, accounting for ice time, position and shot quality.</p>
    </header>
    <p className={styles.muted}>Review cutoff {preview.eventThroughDate} · Checked {preview.evaluatedAtUTC.slice(0, 19).replace("T", " ")} UTC</p>
    <div className={styles.sides}>{preview.rows.map(({ playerId, name, archived, profile, reasons }) =>
      <article className={styles.card} key={playerId} aria-label={name}>
        <h2 className={styles.playerName}>{name}</h2>
        <section aria-label="Dated production" className={styles.evidence}>
          <h3 className={styles.kickerRetro}>Captured appearances through {preview.archiveThrough}</h3>
          {archived ? <>
            <p className={styles.muted}>{archived.dates.join(" · ")}</p>
            <dl className={styles.facts}>
              <div><dt>FHFH points</dt><dd>{archived.total?.toFixed(2) ?? "Unavailable"}</dd></div>
              <div><dt>Points per appearance</dt><dd>{archived.perAppearance?.toFixed(2) ?? "Unavailable"}</dd></div>
              <div><dt>Total ice time</dt><dd>{iceTime(archived.seconds)}</dd></div>
            </dl>
            <p className={styles.muted}>{archived.dates.length === 1
              ? "This capture contains one appearance. Five are required."
              : "Five appearances in this capture. Their status as the latest five is unverified."}</p>
            <p className={styles.muted}>Captured Nov 1. Counts and ice time matched the Nov 7 comparison with official records.</p>
          </> : <p className={styles.muted}>The dated production record is unavailable.</p>}
        </section>
        {profile ? <section aria-label="Reviewed personal baseline comparison">
          <h3 className={styles.sectionTitle}>Reviewed five appearances</h3>
          <p className={styles.muted}>{profile.evidence.window.dates.join(" · ")}</p>
          <p className={styles.muted}>The personal baseline covers {profile.evidence.reference.personalGames} games
            {profile.evidence.reference.dates.length > 0 && <> through {profile.evidence.reference.dates.at(-1)}</>}.</p>
          <EvidenceBlock name={name} playerId={String(playerId)} profile={profile} goalie={false} />
        </section>
          : <section className={styles.evidence} aria-label="Personal baseline comparison">
            <h3 className={styles.kickerRetro}>Personal baseline comparison withheld</h3>
            {reasons.map(reason => <p key={reason} className={styles.muted}>{reviewReason[reason] ?? reason.replace(/_/g, " ")}</p>)}
          </section>}
      </article>)}</div>
  </section>;
}
