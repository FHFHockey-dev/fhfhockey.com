const fs = require('fs');

let content = fs.readFileSync('pages/db/tweet-pattern-review.tsx', 'utf8');

// Need to inject styles import
if (!content.includes('import styles from')) {
  content = content.replace('import Head from "next/head";', 'import Head from "next/head";\nimport styles from "./tweetPatternReview.module.scss";');
}

// Remove old inline styles since we moved them to scss
const startStr = "  return (\n    <>";
const startIdx = content.indexOf(startStr);
if (startIdx === -1) {
  console.error("Could not find start String");
  process.exit(1);
}

const newReturn = `  return (
    <>
      <Head>
        <title>Tweet Pattern Review | FHFH</title>
      </Head>
      <main className={styles.dashboard}>
        <header className={styles.header}>
          <h1>Tweet Pattern Review</h1>
          <div className={styles.headerControls}>
            {statusMessage ? <span style={{ color: "var(--warning-color)" }}>{statusMessage}</span> : null}
            <label className={styles.label} style={{ flexDirection: "row", alignItems: "center", display: "flex", gap: "8px" }}>
              Status
              <select
                className={styles.formControl}
                style={{ width: "auto" }}
                value={statusFilter}
                onChange={(event) => {
                  const nextFilter = event.target.value as ReviewStatus | "all";
                  setStatusFilter(nextFilter);
                  void loadData(nextFilter).catch((error) =>
                    setStatusMessage(error.message),
                  );
                }}
              >
                <option value="pending">Pending</option>
                <option value="reviewed">Reviewed</option>
                <option value="ignored">Ignored</option>
                <option value="all">All</option>
              </select>
            </label>
            <button
              className={styles.buttonPrimary}
              disabled={isSyncing}
              onClick={() => void syncQueue()}
            >
              {isSyncing ? "Syncing..." : "Sync Corpus"}
            </button>
            <div style={{ fontFamily: "var(--font-family-numbers)" }}>
              <strong>{pendingCount}</strong> pending
            </div>
          </div>
        </header>

        <section className={styles.workspace}>
          {/* LEFT: Context Panel */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>Review Queue & Guide</div>
            <div className={styles.panelBody} style={{ gap: "16px" }}>
              <label className={styles.label}>
                Queue Item
                <select
                  className={styles.formControl}
                  value={selectedItemId}
                  onChange={(event) => setSelectedItemId(event.target.value)}
                  disabled={items.length === 0}
                >
                  {items.map((item, index) => (
                    <option key={item.id} value={item.id}>
                      {index + 1}. {item.source_account ?? item.source_key ?? item.source_table} · {item.team_abbreviation ?? "No team"}
                    </option>
                  ))}
                </select>
              </label>

              {isLoading ? <p>Loading...</p> : null}
              {!isLoading && !selectedItem ? (
                <p style={{ color: "var(--text-secondary)" }}>No tweets in this filter.</p>
              ) : null}

              <div style={{ marginTop: "16px", padding: "16px", background: "rgba(255,255,255,0.03)", borderRadius: "var(--radius-panel)", fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>
                <h3 style={{ color: "var(--color-white)", marginTop: 0, marginBottom: "8px", textTransform: "uppercase", fontSize: "14px" }}>Review Guide</h3>
                <p style={{ marginTop: 0, marginBottom: "8px" }}>
                  One tweet can contain several assignments. Use separate blocks when a tweet
                  mixes lines, goalie starts, injuries, scratches, or returns.
                </p>
                <p style={{ margin: 0 }}>
                  Use <strong>OTHER / NON NHL</strong> when the tweet is a useful non-NHL example
                  you want counted in the analysis set. Use <strong>Ignore</strong> only for
                  duplicates, junk, or rows you do not want included at all.
                </p>
                {selectedItem?.parser_filter_reason && (
                  <p style={{ marginTop: "12px", color: "var(--warning-color)" }}>
                    <strong>Current filter reason:</strong> {selectedItem.parser_filter_reason}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* CENTER: Main Review */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>Evidence & Assignments</div>
            <div className={styles.panelBody} style={{ gap: "16px" }}>
              {selectedItem ? (
                <div className={styles.mainView}>
                  <div className={styles.tweetSource} style={{ padding: "16px" }}>
                    <div className={styles.meta}>
                      <span><strong>Source:</strong> {selectedItem.source_account ?? selectedItem.source_key ?? selectedItem.source_table}</span>
                      <span><strong>Team:</strong> {selectedItem.team_abbreviation ?? "Unknown"}</span>
                      <span><strong>Parser:</strong> {selectedItem.parser_classification ?? "None"}</span>
                    </div>
                    <div className={styles.meta}>
                      <span>{formatTimestamp(selectedItem.source_created_at)}</span>
                      {selectedItem.source_url && <a href={selectedItem.source_url} className={styles.link} target="_blank" rel="noreferrer">Source Tweet</a>}
                      {selectedItem.quoted_tweet_url && <a href={selectedItem.quoted_tweet_url} className={styles.link} target="_blank" rel="noreferrer">Quoted Tweet</a>}
                    </div>
                    {selectedItem.keyword_hits && selectedItem.keyword_hits.length > 0 && (
                      <div className={styles.keywordHits}>
                        {selectedItem.keyword_hits.map((keyword) => (
                          <span key={keyword}>{keyword}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <pre
                    className={styles.tweetText}
                    onMouseUp={(event) => {
                      const selection = window.getSelection();
                      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
                        setCapturedSelection("");
                        return;
                      }
                      const range = selection.getRangeAt(0);
                      if (!event.currentTarget.contains(range.commonAncestorContainer)) {
                        setCapturedSelection("");
                        return;
                      }
                      setCapturedSelection(selection.toString().trim());
                    }}
                  >
                    {renderHighlightedText(
                      selectedItem.review_text ?? "No tweet text captured.",
                      assignments.flatMap((assignment) => assignment.highlightPhrases),
                    )}
                  </pre>

                  <div className={styles.assignmentsList}>
                    <div className={styles.controlRow} style={{ justifyContent: "space-between" }}>
                      <strong style={{ color: "var(--color-white)", textTransform: "uppercase" }}>Assignments</strong>
                      <button className={styles.buttonGhost} onClick={() => addAssignment()}>
                        + Add Assignment
                      </button>
                    </div>

                    {assignments.map((assignment, index) => {
                      const selectedCategoryOption =
                        categoryOptions.find(
                          (option) =>
                            option.category.toLowerCase() ===
                            assignment.category.trim().toLowerCase(),
                        ) ?? null;

                      return (
                        <div key={assignment.id} className={styles.assignmentCard}>
                          <div className={styles.controlRow} style={{ justifyContent: "space-between" }}>
                            <strong style={{ color: "var(--color-white)" }}>Assignment {index + 1}</strong>
                            <button className={styles.buttonGhost} style={{ padding: "4px 8px", fontSize: "12px" }} disabled={assignments.length <= 1} onClick={() => removeAssignment(assignment.id)}>
                              Remove
                            </button>
                          </div>
                          
                          <div className={styles.controlGrid}>
                            <label className={styles.label}>
                              Category
                              <input
                                className={styles.formControl}
                                list="tweet-pattern-categories"
                                value={assignment.category}
                                onChange={(event) => updateAssignment(assignment.id, (current) => ({ ...current, category: event.target.value }))}
                                placeholder="INJURY..."
                              />
                            </label>
                            <label className={styles.label}>
                              Subcategory
                              <input
                                className={styles.formControl}
                                list={\`tweet-pattern-subcategories-\${assignment.id}\`}
                                value={assignment.subcategory ?? ""}
                                onChange={(event) => updateAssignment(assignment.id, (current) => ({ ...current, subcategory: event.target.value || null }))}
                                placeholder="QUESTIONABLE..."
                              />
                            </label>
                          </div>

                          <datalist id="tweet-pattern-categories">
                            {categoryOptions.map((option) => (
                              <option key={option.category} value={option.category} />
                            ))}
                          </datalist>
                          <datalist id={\`tweet-pattern-subcategories-\${assignment.id}\`}>
                            {(selectedCategoryOption?.subcategories ?? []).map((subcategory) => (
                              <option key={subcategory} value={subcategory} />
                            ))}
                          </datalist>

                          <div className={styles.controlRow}>
                            <select
                              className={styles.formControl}
                              style={{ flex: 1 }}
                              value={assignment.pendingPlayerId}
                              onChange={(event) => updateAssignment(assignment.id, (current) => ({ ...current, pendingPlayerId: event.target.value }))}
                            >
                              <option value="">Roster Player...</option>
                              {filteredPlayers.map((player) => (
                                <option key={player.id} value={player.id}>
                                  {player.fullName} {player.position ? \`-\` : ""}
                                </option>
                              ))}
                            </select>
                            <button className={styles.button} disabled={!assignment.pendingPlayerId} onClick={() => addPlayerToAssignment(assignment.id)}>
                              Add
                            </button>
                          </div>

                          <div className={styles.controlRow}>
                            <input
                              className={styles.formControl}
                              style={{ flex: 1 }}
                              value={assignment.pendingPlayerName}
                              onChange={(event) => updateAssignment(assignment.id, (current) => ({ ...current, pendingPlayerName: event.target.value }))}
                              placeholder="Manual Name..."
                            />
                            <button className={styles.button} disabled={!assignment.pendingPlayerName.trim()} onClick={() => addManualPlayerNameToAssignment(assignment.id)}>
                              Add
                            </button>
                          </div>

                          {assignment.playerNames.length > 0 && (
                            <div className={styles.controlRow}>
                              {assignment.playerNames.map((playerName) => (
                                <button key={\`\${assignment.id}-\${playerName}\`} className={styles.chip} onClick={() => removePlayerFromAssignment(assignment.id, playerName)}>
                                  {playerName} ×
                                </button>
                              ))}
                            </div>
                          )}

                          <div className={styles.controlRow}>
                            <input
                              className={styles.formControl}
                              style={{ flex: 1 }}
                              value={assignment.pendingHighlight}
                              onChange={(event) => updateAssignment(assignment.id, (current) => ({ ...current, pendingHighlight: event.target.value }))}
                              placeholder="Expected starter..."
                            />
                            <button className={styles.button} disabled={!assignment.pendingHighlight.trim()} onClick={() => addHighlightToAssignment(assignment.id, assignment.pendingHighlight)}>
                              Add
                            </button>
                            <button className={styles.button} disabled={!capturedSelection} onClick={() => addHighlightToAssignment(assignment.id, capturedSelection)}>
                              Add Selected
                            </button>
                          </div>

                          {assignment.highlightPhrases.length > 0 && (
                            <div className={styles.controlRow}>
                              {assignment.highlightPhrases.map((phrase) => (
                                <button key={\`\${assignment.id}-\${phrase}\`} className={styles.chipYellow} onClick={() => removeHighlightFromAssignment(assignment.id, phrase)}>
                                  {phrase} ×
                                </button>
                              ))}
                            </div>
                          )}

                          <label className={styles.label}>
                            Notes
                            <input
                              className={styles.formControl}
                              value={assignment.notes ?? ""}
                              onChange={(event) => updateAssignment(assignment.id, (current) => ({ ...current, notes: event.target.value || null }))}
                              placeholder="Optional reasoning..."
                            />
                          </label>
                          <button className={styles.buttonGhost} style={{ alignSelf: "flex-start", marginTop: "8px", fontSize: "12px", padding: "4px 8px" }} onClick={() => applyAssignmentToNewsDraft(assignment)}>
                            Use for news card →
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)" }}>
                  Select a queue item to start reviewing.
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className={styles.footerActions} style={{ padding: "16px", background: "rgba(0,0,0,0.1)", borderTop: "1px solid var(--border-soft)" }}>
               <button className={styles.button} disabled={currentIndex <= 0} onClick={() => moveSelection(-1)}>
                 ← Previous
               </button>
               <button className={styles.button} disabled={currentIndex < 0 || currentIndex >= items.length - 1} onClick={() => moveSelection(1)}>
                 Next →
               </button>
               <div style={{ flex: 1 }} />
               <button className={styles.buttonGhost} disabled={isSaving} onClick={() => void updateReviewStatus("ignore")}>
                 Ignore
               </button>
               <button className={styles.buttonGhost} disabled={isSaving} onClick={() => void updateReviewStatus("requeue")}>
                 Requeue
               </button>
               <button className={styles.buttonPrimary} disabled={isSaving} onClick={() => void saveReview()}>
                 {isSaving ? "Saving..." : "Save Assignments"}
               </button>
            </div>
          </div>

          {/* RIGHT: News Draft & Keywords */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>Downstream Outputs</div>
            <div className={styles.panelBody} style={{ gap: "24px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className={styles.controlRow} style={{ justifyContent: "space-between" }}>
                  <strong style={{ color: "var(--color-white)", textTransform: "uppercase" }}>News Composer</strong>
                  <a href="/news" className={styles.link} target="_blank" rel="noreferrer">Open /news</a>
                </div>

                <div className={styles.controlGrid}>
                  <label className={styles.label}>
                    Headline
                    <input className={styles.formControl} value={newsDraft.headline} onChange={(e) => setNewsDraft((c) => ({ ...c, headline: e.target.value }))} />
                  </label>
                  <label className={styles.label}>
                    Team
                    <select className={styles.formControl} value={newsDraft.teamId} onChange={(e) => {
                      const team = teamOptions.find((o) => String(o.id) === e.target.value);
                      setNewsDraft((c) => ({ ...c, teamId: e.target.value, teamAbbreviation: team?.abbreviation ?? "" }));
                    }}>
                      <option value="">Team...</option>
                      {teamOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </label>
                  <label className={styles.label}>
                    Category
                    <input className={styles.formControl} value={newsDraft.category} onChange={(e) => setNewsDraft((c) => ({ ...c, category: e.target.value }))} />
                  </label>
                  <label className={styles.label}>
                    Subcategory
                    <input className={styles.formControl} value={newsDraft.subcategory} onChange={(e) => setNewsDraft((c) => ({ ...c, subcategory: e.target.value }))} />
                  </label>
                </div>

                <label className={styles.label}>
                  Blurb
                  <textarea className={styles.formControl} rows={3} value={newsDraft.blurb} onChange={(e) => setNewsDraft((c) => ({ ...c, blurb: e.target.value }))} />
                </label>

                <div className={styles.controlRow}>
                  <select className={styles.formControl} style={{ flex: 1 }} value={newsDraft.pendingPlayerId} onChange={(e) => setNewsDraft((c) => ({ ...c, pendingPlayerId: e.target.value }))}>
                    <option value="">Roster Player...</option>
                    {filteredDraftPlayers.map((player) => (
                      <option key={player.id} value={player.id}>{player.fullName}</option>
                    ))}
                  </select>
                  <button className={styles.button} disabled={!newsDraft.pendingPlayerId} onClick={() => addPlayerToNewsDraft()}>Add</button>
                </div>

                <div className={styles.controlRow}>
                  <input className={styles.formControl} style={{ flex: 1 }} value={newsDraft.pendingPlayerName} onChange={(e) => setNewsDraft((c) => ({ ...c, pendingPlayerName: e.target.value }))} placeholder="Manual Name..." />
                  <button className={styles.button} disabled={!newsDraft.pendingPlayerName.trim()} onClick={() => addManualPlayerToNewsDraft()}>Add</button>
                </div>

                {newsDraft.playerNames.length > 0 && (
                  <div className={styles.controlRow}>
                    {newsDraft.playerNames.map((pn) => (
                      <button key={\`news-draft-\${pn}\`} className={styles.chip} onClick={() => removePlayerFromNewsDraft(pn)}>{pn} ×</button>
                    ))}
                  </div>
                )}

                {selectedItem && (
                  <div style={{ marginTop: "8px" }}>
                    <NewsCard
                      item={{
                        headline: newsDraft.headline || "Draft headline",
                        blurb: newsDraft.blurb || "Write a concise fantasy-news blurb for this update.",
                        category: normalizeNewsCategory(newsDraft.category) || "UPDATE",
                        subcategory: normalizeNewsCategory(newsDraft.subcategory) || null,
                        team_abbreviation: newsDraft.teamAbbreviation || selectedItem.team_abbreviation,
                        source_label: selectedItem.source_label,
                        source_account: selectedItem.source_account,
                        source_url: selectedItem.source_url,
                        published_at: null,
                        created_at: new Date().toISOString(),
                        card_status: "draft",
                        players: newsDraft.playerNames.map((playerName, index) => ({
                          id: \`\${playerName}-\${index}\`,
                          news_item_id: "draft",
                          player_id: newsDraft.playerIds[index] ?? null,
                          player_name: playerName,
                          team_id: Number(newsDraft.teamId) || selectedItem.team_id,
                          role: "subject",
                        })),
                      }}
                    />
                  </div>
                )}

                <div className={styles.controlRow}>
                  <button className={styles.buttonGhost} disabled={isSavingNews} onClick={() => void saveNewsCard("draft")}>Save Draft</button>
                  <button className={styles.buttonPrimary} disabled={isSavingNews} onClick={() => void saveNewsCard("published")}>Publish</button>
                </div>

                 {savedNewsItems.length > 0 && (
                  <div style={{ marginTop: "16px", display: "grid", gap: "8px" }}>
                    <strong style={{ color: "var(--color-white)", fontSize: "14px" }}>Saved Cards</strong>
                    {savedNewsItems.map((item) => (
                      <div key={item.id} style={{ display: "grid", gap: "4px" }}>
                        <NewsCard item={item} />
                        <button className={styles.buttonGhost} style={{ fontSize: "12px", padding: "4px" }} onClick={() => setNewsDraft({
                          itemId: item.id, headline: item.headline, blurb: item.blurb, category: item.category,
                          subcategory: item.subcategory ?? "", teamId: item.team_id ? String(item.team_id) : "",
                          teamAbbreviation: item.team_abbreviation ?? "", playerIds: item.players.map((p) => p.player_id ?? 0).filter(Boolean),
                          playerNames: item.players.map((p) => p.player_name), pendingPlayerId: "", pendingPlayerName: ""
                        })}>Load Editor</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ borderTop: "1px dashed var(--border-soft)", margin: "8px 0" }} />

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <strong style={{ color: "var(--color-white)", textTransform: "uppercase" }}>Novel Keywords</strong>
                
                <div className={styles.controlGrid}>
                  <label className={styles.label}>
                    Phrase
                    <input className={styles.formControl} value={keywordDraft.phrase} onChange={(e) => setKeywordDraft((c) => ({ ...c, phrase: e.target.value }))} />
                  </label>
                  <label className={styles.label}>
                    Category
                    <input className={styles.formControl} value={keywordDraft.category} onChange={(e) => setKeywordDraft((c) => ({ ...c, category: e.target.value }))} />
                  </label>
                  <label className={styles.label}>
                    Subcat
                    <input className={styles.formControl} value={keywordDraft.subcategory} onChange={(e) => setKeywordDraft((c) => ({ ...c, subcategory: e.target.value }))} />
                  </label>
                </div>
                <label className={styles.label}>
                  Notes
                  <input className={styles.formControl} value={keywordDraft.notes} onChange={(e) => setKeywordDraft((c) => ({ ...c, notes: e.target.value }))} />
                </label>
                <button className={styles.button} disabled={isSavingKeyword} onClick={() => void saveKeywordPhrase()}>
                  {isSavingKeyword ? "Saving" : "Save Keyword"}
                </button>

                {savedKeywordPhrases.length > 0 && (
                  <div className={styles.controlRow}>
                    {savedKeywordPhrases.map((phrase) => (
                       <span key={phrase.id} className={styles.chipYellow}>{phrase.phrase}</span>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </section>
      </main>
    </>
  );
};

export default TweetPatternReviewPage;
`;

const replaceStr = content.substring(startIdx);
content = content.replace(replaceStr, newReturn);
fs.writeFileSync('pages/db/tweet-pattern-review.tsx', content);
console.log('Done');
