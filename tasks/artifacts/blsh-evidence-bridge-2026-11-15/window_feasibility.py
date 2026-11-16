"""How many native capture dates does a complete latest-five window need, and can the gate qualify it?

Read-only, offline. Uses the retained 11-01 CURRENT-REQUEST (real WGO dates). Aggregate output only.

Rules combined (none softened):
- Capture rule, nativeProcessCapturePreparation.ts:48: a date D is capturable at time T only if D < date(T)
  and T - D00:00Z < 8 days. One packet = one date (the gate requires fd = td = the game date, :189-195).
- Gate capture-age rule, currentProcessEvidence.server.ts:213-214 (inside the try, so it also fails the
  source observation): evaluation E - earliest(native retrieval, frame observation, request captures)
  <= maxCaptureAgeHours. Each window member's own native receipt must therefore be retrieved in [E-H, E].
- Gate current-use rule (:215): date(E) - D <= maxEventAgeDays for the member to be current-use qualified.

Derivation, H = maxCaptureAgeHours (24 in the retained policy), E late in day X:
  latest member L <= X - 1 (captured no later than E, date must be before the capture day);
  oldest member O needs a capture T_O >= E - H with T_O - O00:00 < 8 d, so O >= X - 7 - ceil(H/24) (sup over E).
  => all five members source-observation-qualified at one E requires span = L - O <= 6 + ceil(H / 24),
     i.e. span <= 7 for H = 24 (only with E at the very end of day X and the oldest capture ~24 h earlier).
  current use of all five members additionally requires X - O <= maxEventAgeDays (7) => span <= 6.
"""
import json
import math
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

REQUEST = Path('/Users/tim/Documents/Codex/2026-10-27/task-3/current-refresh-reader-20261101-01/live-read-01/capture/CURRENT-REQUEST.json')
HERE = Path(__file__).resolve().parent


def main():
    r = json.loads(REQUEST.read_text())
    policy = r['freshnessPolicy']; hours = policy['maxCaptureAgeHours']; event_days = policy['maxEventAgeDays']
    by_player = defaultdict(list)
    for w in r['wgo']['rows']:
        if w['games_played'] == 1: by_player[w['player_id']].append(w['date'])
    spans, recent_union = [], set()
    for dates in by_player.values():
        dates = sorted(set(dates))
        if len(dates) < 5: continue
        window = dates[-5:]
        spans.append((date.fromisoformat(window[-1]) - date.fromisoformat(window[0])).days)
        if window[-1] >= '2026-10-25': recent_union.update(window)
    n = len(spans); spans.sort()
    max_span_source = 6 + math.ceil(hours / 24)   # 7 for H = 24
    max_span_current = event_days - 1       # 6 for maxEventAgeDays = 7
    games_by_date = Counter(c['date'] for c in r['calendar']['rows'] if c['type'] == 2)
    trailing = sorted(d for d in games_by_date if d <= r['eventThroughDate'])[-8:]
    out = {
        'version': 'fhfh.blsh.evidence-bridge.window-feasibility.v1', 'source': 'retained CURRENT-REQUEST 2026-11-01 (aggregate only)',
        'policy': policy, 'playersWithFiveOrMoreGames': n, 'playersTotal': len(by_player),
        'latestFiveSpanDays': {'min': spans[0], 'median': spans[n // 2], 'p90': spans[(9 * n) // 10], 'max': spans[-1], 'distribution': dict(sorted(Counter(spans).items()))},
        'perPlayer': {'nativeCaptureDates': 5, 'nstRequests': 10, 'boxscoreCalls': 5,
                      'why': 'one packet captures one game date (fd = td); a player plays at most once per date'},
        'singleEvaluationFeasibility': {
            'maxSpanAllFiveSourceObservationQualified': max_span_source,
            'windowsFeasibleSourceObservation': sum(s <= max_span_source for s in spans),
            'maxSpanAllFiveCurrentUseQualified': max_span_current,
            'windowsFeasibleCurrentUse': sum(s <= max_span_current for s in spans),
            'note': 'feasible means the dates allow it; all five packets, all frames and the request capture must still fall within the same maxCaptureAgeHours before evaluation',
        },
        'cohortCoverageAtOneEvaluation': {
            'distinctCaptureDatesNeeded': 'every game date in [X-8, X-1]: up to 8 single-date packets (16 NST requests, 8 schedule calls), all within the 24 h before evaluation',
            'trailing8GameDates': trailing, 'boxscoreCallsForThoseDates': sum(games_by_date[d] for d in trailing),
            'unionOfDatesInRecentLatestFiveWindows': len(recent_union),
        },
        'gateWindowAdmission': 'never: capturedWindows hard-codes completeLatestFiveEstablished=false and currentUseQualified=false (currentProcessEvidence.server.ts:262-266)',
    }
    if len(sys.argv) > 1: Path(sys.argv[1]).write_text(json.dumps(out, indent=2) + '\n')  # explicit output path only
    print(json.dumps(out['singleEvaluationFeasibility']))


if __name__ == '__main__':
    main()
