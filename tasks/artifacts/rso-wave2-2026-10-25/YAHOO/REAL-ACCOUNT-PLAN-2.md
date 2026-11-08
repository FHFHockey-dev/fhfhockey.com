# RSO-YAHOO window 2: R2–R4 (proposal; needs TJ's pop-up approval for a specific date)

Sized from the 2026-10-26 run (WINDOW-RESULTS-2026-10-26.md): one connected snapshot load = 6 base reads + **58 discovery pages ≈ 64 Yahoo reads**. Opening a connected RSO tab automatically runs access, snapshot and goalie-confirmation reads.

## Preconditions
1. The RSO-ONLINE fix is released (RSO no longer stalls when Chrome misreports navigator.onLine).
2. TJ approves the date and budget by pop-up.
3. **Exactly one RSO tab**, in Claude's group, on production fhfhockey.com in TJ's Chrome. Claude checks `navigator.onLine` and the tab count before opening.
4. Read-only: no transactions, lineup edits, waiver claims or scope changes. Evidence is counts, booleans and limitation strings only, with names scrubbed in the page.
5. Stop on yahoo_rate_limited, yahoo_reauth_required, yahoo_access_denied, any non-200, a second RSO tab appearing, or a read count that would pass the ceiling.

## Steps and budget
| Step | When | Action | Yahoo reads |
|---|---|---|---|
| R2 | Afternoon, after Yahoo posts goalie marks and before the owned goalie's game | Open the single RSO tab. This auto-runs the snapshot plus confirmations; record (d) the weekly counter and (e) the goalie starting_status shape, start chance 1/0, per-start line kept, expiresAt − observed ≤ 2 min | ≈ 64 + ≤3 |
| R3 | ≥ 60 s after R2, same tab | One explicit Refresh provider. Record (g): selected moves kept, reconciliation issues for changed facts, suggestedSteps null or not | ≈ 64 |
| R4 | After the owned goalie's game starts, same tab, no reload | One confirmations read (the explicit control, if the UI offers it; otherwise skip, since a reload would cost another ~64). Record (e): the started game is withheld and rows unchanged | ≤ 2 |
| **Total** | | | **≈ 135, ceiling 150** |

## Pass criteria
- The (d) allowance comes only from a fresh, owned, scoped current-week counter.
- (e) A verified fresh mark sets 1/0; a started game is withheld.
- (g) A refresh never silently replaces the selected moves.
