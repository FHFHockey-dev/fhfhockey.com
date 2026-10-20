"""Offline experiment machinery. No HTTP client, credentials, or paid executor.

Money is integer nano-USD, rounded upward; SQLite is a local experiment ledger,
not a replacement for the application's durable claim/outbox protocol.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
import random
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CAP = 260_000_000
ARMS = ("rules", "rules_decisions", "extraction", "extraction_decisions")
FIELDS = ("player", "player_id", "team", "role", "event", "value", "polarity",
          "certainty", "time", "condition", "source_id", "source_author")
EXTERNAL_FIELDS = ("player_id", "team", "game_id", "season", "date")


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def utc():
    return datetime.now(timezone.utc).isoformat()


def integer(value, minimum=0):
    if type(value) is not int or value < minimum:
        raise ValueError("invalid nonnegative integer")
    return value


def ceiling(value: Fraction):
    return -(-value.numerator // value.denominator)


def reservation(endpoint, input_tokens, output_tokens=0):
    """Conditional bounds only: short context, default tier, <=10% premium.

    Callers must independently prove input counts, exact model/account rates and
    output enforcement before this calculation can authorize a real request.
    """
    integer(input_tokens)
    integer(output_tokens)
    if input_tokens > 4096 or output_tokens > 1024:
        raise ValueError("outside conditional short-context envelope")
    if endpoint == "responses":
        # Reserve highest short-input price, including cache writes.
        dollars = (input_tokens * Fraction("0.125") + output_tokens * Fraction("0.50")) / 1_000_000
    elif endpoint == "decisions" and output_tokens == 0:
        dollars = input_tokens * Fraction("0.10") / 1_000_000
    else:
        raise ValueError("unsupported endpoint/output")
    return ceiling(dollars * Fraction("1.10") * 1_000_000_000)


class Ledger:
    """Atomic whole-bundle reservations; one dispatch in flight, no resend API.

    All failed or uncertain attempts retain their original reservation. A process
    dying in 'sent' is detected at next entry and blocks the whole experiment.
    Reserved-but-unsent siblings remain reserved. Reopening never releases them.
    """
    def __init__(self, path, experiment_hash):
        self.db = sqlite3.connect(path, timeout=2, isolation_level=None)
        self.db.execute("PRAGMA synchronous=FULL")
        self.db.execute("PRAGMA foreign_keys=ON")
        with self.tx():
            self.db.execute("CREATE TABLE IF NOT EXISTS experiment (id INTEGER PRIMARY KEY CHECK(id=1), hash TEXT NOT NULL, cap INTEGER NOT NULL, blocked TEXT)")
            self.db.execute("CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY, bundle TEXT NOT NULL, endpoint TEXT NOT NULL, request TEXT NOT NULL, request_hash TEXT NOT NULL, reserve INTEGER NOT NULL CHECK(reserve>0), state TEXT NOT NULL CHECK(state IN ('reserved','sent','settled','uncertain')), actual INTEGER, response TEXT, error TEXT, started TEXT, finished TEXT)")
            self.db.execute("INSERT OR IGNORE INTO experiment VALUES(1,?,?,NULL)", (experiment_hash, CAP))
            row = self.db.execute("SELECT hash,cap FROM experiment").fetchone()
            if row != (experiment_hash, CAP):
                raise ValueError("experiment identity/cap mismatch")

    @contextmanager
    def tx(self):
        self.db.execute("BEGIN IMMEDIATE")
        try:
            yield
            self.db.execute("COMMIT")
        except BaseException:
            self.db.execute("ROLLBACK")
            raise

    def close(self):
        self.db.close()

    def _exposure(self):
        return self.db.execute("SELECT COALESCE(SUM(CASE WHEN state='settled' THEN actual ELSE MAX(reserve,COALESCE(actual,0)) END),0) FROM attempts").fetchone()[0]

    def reserve_bundle(self, bundle, attempts):
        if not attempts or len(attempts) != 3 or {a['endpoint'] for a in attempts} != {'responses', 'decisions'}:
            raise ValueError("one Responses and two Decisions required")
        if sum(a['endpoint'] == 'responses' for a in attempts) != 1:
            raise ValueError("unpaired bundle")
        # The full conditional envelope is charged before any request of a post.
        for a in attempts:
            integer(a['reserve'], 1)
            if a['reserve'] > CAP:
                raise ValueError("oversized reservation")
        with self.tx():
            if self.db.execute("SELECT blocked FROM experiment").fetchone()[0]:
                raise RuntimeError("experiment blocked")
            if self.db.execute("SELECT 1 FROM attempts WHERE state IN ('sent','uncertain')").fetchone():
                raise RuntimeError("unreconciled outcome")
            if self.db.execute("SELECT 1 FROM attempts WHERE bundle=?", (bundle,)).fetchone():
                raise RuntimeError("bundle already reserved; never allocate a second mutation")
            counts = dict(self.db.execute("SELECT endpoint,COUNT(*) FROM attempts GROUP BY endpoint").fetchall())
            if counts.get('responses',0)+1>126 or counts.get('decisions',0)+2>252:
                raise RuntimeError('finite aggregate request-count cap refused')
            if self._exposure() + sum(a['reserve'] for a in attempts) > CAP:
                raise RuntimeError("hard cap refused before dispatch")
            for a in attempts:
                request = canonical(a['request'])
                self.db.execute("INSERT INTO attempts(id,bundle,endpoint,request,request_hash,reserve,state) VALUES(?,?,?,?,?,?,'reserved')",
                                (a['id'], bundle, a['endpoint'], request, digest(a['request']), a['reserve']))

    def bind(self, attempt_id, request):
        # The extraction-verification request cannot exist before extraction.
        # Its full ceiling is already reserved. Bind it once before dispatch.
        if not isinstance(request, dict):
            raise ValueError('request must be an object')
        with self.tx():
            row = self.db.execute("SELECT state,request FROM attempts WHERE id=?", (attempt_id,)).fetchone()
            if row != ('reserved', 'null') or self.db.execute("SELECT blocked FROM experiment").fetchone()[0]:
                raise RuntimeError('request already bound or experiment blocked')
            self.db.execute("UPDATE attempts SET request=?,request_hash=? WHERE id=?", (canonical(request), digest(request), attempt_id))

    def begin(self, attempt_id, request):
        if not isinstance(request, dict):
            raise ValueError('exact request required before dispatch')
        blocked = None
        with self.tx():
            if self.db.execute("SELECT 1 FROM attempts WHERE state IN ('sent','uncertain')").fetchone():
                blocked = "unreconciled previous dispatch; retained full reservations"
                self.db.execute("UPDATE experiment SET blocked=?", (blocked,))
            elif self.db.execute("SELECT blocked FROM experiment").fetchone()[0]:
                blocked = "experiment blocked"
            else:
                row = self.db.execute("SELECT state,request_hash FROM attempts WHERE id=?", (attempt_id,)).fetchone()
                if row != ('reserved', digest(request)):
                    raise RuntimeError("missing, changed, or already dispatched attempt")
                self.db.execute("UPDATE attempts SET state='sent',started=? WHERE id=?", (utc(), attempt_id))
        if blocked:
            raise RuntimeError(blocked)

    def settle(self, attempt_id, response, actual_nano_usd):
        """For authoritative, completely priced usage only; not visible text length.

        This primitive does not authenticate provider usage/rates. The absent paid
        adapter must do that. Unparseable/missing billing must use uncertain().
        """
        integer(actual_nano_usd)
        excess = False
        with self.tx():
            row = self.db.execute("SELECT state,reserve FROM attempts WHERE id=?", (attempt_id,)).fetchone()
            if not row or row[0] != 'sent':
                raise RuntimeError("settlement is not for the current sent attempt")
            excess = actual_nano_usd > row[1]
            if excess:
                self.db.execute("UPDATE attempts SET state='uncertain',actual=?,response=?,error=?,finished=? WHERE id=?",
                                (actual_nano_usd, canonical(response), 'bound_violation', utc(), attempt_id))
                self.db.execute("UPDATE experiment SET blocked='provider bound violated'")
            else:
                self.db.execute("UPDATE attempts SET state='settled',actual=?,response=?,finished=? WHERE id=?",
                                (actual_nano_usd, canonical(response), utc(), attempt_id))
        if excess:
            raise RuntimeError("provider exceeded reservation; ceiling no longer established")

    def uncertain(self, attempt_id, error, response=None):
        with self.tx():
            row = self.db.execute("SELECT state FROM attempts WHERE id=?", (attempt_id,)).fetchone()
            if row != ('sent',):
                raise RuntimeError("not a sent attempt")
            self.db.execute("UPDATE attempts SET state='uncertain',error=?,response=?,finished=? WHERE id=?",
                            (str(error), canonical(response), utc(), attempt_id))
            self.db.execute("UPDATE experiment SET blocked='unknown billed outcome'")

    def snapshot(self):
        rows = self.db.execute("SELECT id,bundle,endpoint,request_hash,reserve,state,actual,error,started,finished FROM attempts ORDER BY id").fetchall()
        known = self.db.execute("SELECT COALESCE(SUM(actual),0) FROM attempts WHERE actual IS NOT NULL").fetchone()[0]
        return dict(cap_nano_usd=CAP, exposure_nano_usd=self._exposure(), known_nano_usd=known,
                    blocked=self.db.execute("SELECT blocked FROM experiment").fetchone()[0], attempts=rows)


def utf16_slice(text, span):
    if not isinstance(span, dict) or set(span) != {'start', 'end', 'text'}:
        raise ValueError("invalid evidence shape")
    start, end = span['start'], span['end']
    integer(start)
    integer(end)
    raw = text.encode('utf-16-le')
    if end <= start or end * 2 > len(raw):
        raise ValueError("evidence out of bounds")
    try:
        exact = raw[start*2:end*2].decode('utf-16-le')
    except UnicodeError as e:
        raise ValueError("split surrogate") from e
    if exact != span['text']:
        raise ValueError("evidence mismatch")
    return exact


def validate_claim(source, claim):
    if not isinstance(claim, dict) or set(claim) != set(FIELDS) | {'id', 'evidence'}:
        raise ValueError("invalid claim schema")
    if not isinstance(claim['id'], str) or not claim['id']:
        raise ValueError("invalid claim id")
    if any(v is not None and not isinstance(v, str) for k, v in claim.items() if k in FIELDS):
        raise ValueError("fields must be strings or null")
    if any(not claim[k] for k in ('player', 'event', 'value', 'polarity', 'certainty', 'source_id', 'source_author')):
        raise ValueError("missing required proposition")
    if claim['source_id'] != source['source_id'] or claim['source_author'] != source['author']:
        raise ValueError("original source mismatch")
    if claim['polarity'] not in ('positive', 'negative') or claim['certainty'] not in ('asserted', 'tentative', 'conditional', 'observation'):
        raise ValueError("unknown polarity/certainty")
    utf16_slice(source['text'], claim['evidence'])
    return copy.deepcopy(claim)


def normalize(source, body):
    if not isinstance(body, dict) or set(body) != {'claims', 'material', 'overflow'} or type(body['material']) is not bool or type(body['overflow']) is not bool or not isinstance(body['claims'], list):
        return dict(claims=[], material=None, errors=['malformed_reply'])
    if body['overflow'] or len(body['claims']) > 32:
        return dict(claims=[], material=body['material'], errors=['claim_overflow'])
    claims, errors, seen = [], [], set()
    for claim in body['claims']:
        try:
            c = validate_claim(source, claim)
            if c['id'] in seen:
                raise ValueError("duplicate claim id")
            seen.add(c['id'])
            claims.append(c)
        except (ValueError, TypeError, KeyError) as error:
            errors.append(str(error))
    return dict(claims=claims, material=body['material'], errors=errors)


def qualify(source, proposals):
    """Identical source-only policy for all arms; world authority always held.

    IDs/team/date require separate as-of context evidence. This experiment never
    changes app state. 'accepted' means source-proposition eligibility only.
    """
    rows = []
    for claim in proposals['claims']:
        holds = []
        if not source.get('published_at'):
            holds.append('missing_original_publication_clock')
        if source.get('attribution_status') != 'original':
            holds.append('unresolved_original_attribution')
        if claim['certainty'] not in ('asserted', 'observation') or claim['condition']:
            holds.append('governing_qualification')
        if claim['time'] is None:
            holds.append('unresolved_time')
        # Explicitly bound single-player evidence, not silent first-player selection.
        mentions = [p for p in source.get('players', []) if any(n in claim['evidence']['text'] for n in [p['fullName'], *p.get('aliases', [])])]
        if len(mentions) != 1:
            holds.append('single_subject_evidence_unproved')
        if claim['event'] in ('line', 'pp'):
            holds.append('unit_decomposition_unreviewed')
        rows.append(dict(claim=claim, accepted=not holds, holds=holds, world_authority=False))
    return rows


def apply_decisions(rows, decision):
    """A verifier can only remove eligibility, never invent/repair a proposal.

    Thresholds are frozen pilot defaults, explicitly uncalibrated. A later
    calibration change needs a new config hash before opening holdout.
    """
    result = copy.deepcopy(rows)
    for row in result:
        answer = decision.get(row['claim']['id']) if isinstance(decision, dict) else None
        expected = {'supported', 'confidence', 'wording'}
        valid = isinstance(answer, dict) and set(answer) == expected and type(answer['supported']) is bool and type(answer['confidence']) in (float, int) and math.isfinite(answer['confidence']) and 0 <= answer['confidence'] <= 1
        if not valid or not answer['supported'] or answer['confidence'] < .95 or answer['wording'] != 'direct_assertion':
            row['accepted'] = False
            row['holds'].append('verifier_unknown_or_unsupported')
    return result


def statement(claim):
    """Lossless declared proposition serialization; not native-fact equivalence."""
    return 'Evaluate every field of this source proposition: ' + canonical({k: claim[k] for k in FIELDS})


def request_input(source):
    # No label, arm output, gold, or arbitrary caller field enters a request.
    result = {k: copy.deepcopy(source.get(k)) for k in ('source_id', 'text', 'author', 'url', 'published_at', 'received_at')}
    player_keys=('playerId','fullName','lastName','teamId','position','aliases')
    result['players']=[{k:copy.deepcopy(p[k]) for k in player_keys if k in p} for p in source.get('players',[])]
    context=source.get('context') or {}
    evidence_keys=('field','value','source_url','published_at','valid_from','valid_to')
    result['context']={'kind':context.get('kind'), 'evidence':[
        {k:e[k] for k in evidence_keys if k in e and (e[k] is None or isinstance(e[k],str))}
        for e in context.get('evidence',[]) if isinstance(e,dict)]}
    return result


def freeze_splits(sources):
    """Whole-family chronological 3:1:2 split. No labels/predictions considered.

    Caller supplies reviewed cross-links (original/relay/quote/edit/near duplicate).
    This function detects conflicting declared aliases; it cannot discover missing
    cross-links and therefore cannot itself certify an untouched real holdout.
    """
    families, alias_owner = {}, {}
    for s in sources:
        family = s['family_id']
        families.setdefault(family, []).append(s)
        for alias in {s['source_id'], digest(s['text']), *s.get('aliases', [])}:
            if alias in alias_owner and alias_owner[alias] != family:
                raise ValueError('alias/text leaks across families')
            alias_owner[alias] = family
    ordered = sorted(families, key=lambda f: (max(s.get('published_at') or '' for s in families[f]), f))
    if len(ordered) < 6:
        raise ValueError('at least six families required')
    dev_end, cal_end = len(ordered)//2, len(ordered)*2//3
    return {f: 'development' if i < dev_end else 'calibration' if i < cal_end else 'holdout' for i, f in enumerate(ordered)}


def validate_labels(source, labels):
    if labels['source_hash'] != digest(request_input(source)) or labels['complete'] is not True:
        raise ValueError('labels not bound/complete')
    if labels['provenance']['kind'] not in ('synthetic_software_control', 'source_adjudicated', 'provisional_ai'):
        raise ValueError('unknown label provenance')
    ids = set()
    for gold in labels['claims']:
        if gold['id'] in ids:
            raise ValueError('duplicate gold id')
        ids.add(gold['id'])
        utf16_slice(source['text'], gold['evidence'])
        if set(gold['expected']) != set(FIELDS) or not set(gold['gradable']).issubset(FIELDS):
            raise ValueError('invalid grading mask')


def match_claims(gold, predicted):
    """Maximum-weight one-to-one matching, independent of full field equality.

    Match on same subject mention and event; an overlapping same-event span also
    permits a wrong-player prediction to be paired and graded as wrong identity.
    Field errors still count FP+FN. Bitmask DP is bounded to <=16 labeled claims.
    """
    if len(gold) > 16 or len(predicted) > 32:
        raise ValueError('matching overflow; retain as error, never truncate')
    states = {0: (0, [])}
    for pi, p in enumerate(predicted):
        new = dict(states)
        for mask, (score, pairs) in states.items():
            for gi, g in enumerate(gold):
                e = g['expected']
                overlap = max(g['evidence']['start'], p['evidence']['start']) < min(g['evidence']['end'], p['evidence']['end'])
                if mask & (1 << gi) or e['event'] != p['event'] or (e['player'] != p['player'] and not overlap):
                    continue
                weight = 100 + sum(e[k] == p[k] for k in g['gradable'])
                nxt = mask | (1 << gi)
                if nxt not in new or score + weight > new[nxt][0]:
                    new[nxt] = (score + weight, pairs + [(gi, pi)])
        states = new
    return max(states.values(), key=lambda row: row[0])[1]


def grade(source, labels, rows, material=None, errors=()):
    validate_labels(source, labels)
    pred = [r['claim'] for r in rows]
    pairs = match_claims(labels['claims'], pred)
    exact, unsafe, usable, taxonomy = 0, 0, 0, []
    fields = {k:dict(correct=0,total=sum(k in g['gradable'] for g in labels['claims']),
                    gold_nonnull=sum(k in g['gradable'] and g['expected'][k] is not None for g in labels['claims']),
                    predicted_nonnull=sum(p[k] is not None for p in pred),correct_nonnull=0) for k in FIELDS
              if any(k in g['gradable'] for g in labels['claims'])}
    matched_p = set()
    for gi, pi in pairs:
        matched_p.add(pi)
        g, p = labels['claims'][gi], pred[pi]
        wrong = [k for k in g['gradable'] if p[k] != g['expected'][k]]
        for k in g['gradable']:
            counts = fields[k]
            counts['correct'] += k not in wrong
            counts['correct_nonnull'] += k not in wrong and p[k] is not None
        exact += not wrong
        if wrong:
            taxonomy.append(dict(type='field_error', fields=wrong, gold=g['id'], predicted=p['id']))
        unsafe += bool(rows[pi]['accepted'] and (wrong or not g['actionable']))
        usable += bool(rows[pi]['accepted'] and not wrong and g['actionable'])
    unmatched = [p for i,p in enumerate(pred) if i not in matched_p]
    hallucinations = len(unmatched)
    for p in unmatched:
        same = any(all(p[k] == q[k] for k in FIELDS) for q in pred if q['id'] != p['id'])
        taxonomy.append(dict(type='duplicate' if same else 'unmatched_assertion', predicted=p['id']))
    unsafe += sum(r['accepted'] for i, r in enumerate(rows) if i not in matched_p)
    actionable_gold = sum(g['actionable'] for g in labels['claims'])
    ungradable_fields = sum(len(FIELDS)-len(g['gradable']) for g in labels['claims'])
    for counts in fields.values():
        counts['precision'] = counts['correct_nonnull']/counts['predicted_nonnull'] if counts['predicted_nonnull'] else None
        counts['recall'] = counts['correct_nonnull']/counts['gold_nonnull'] if counts['gold_nonnull'] else None
    accepted = sum(r['accepted'] for r in rows)
    return dict(tp=exact, fp=len(pred)-exact, fn=len(labels['claims'])-exact,
                proposal_precision=exact/len(pred) if pred else None,
                proposal_recall=exact/len(labels['claims']) if labels['claims'] else None,
                eligible_precision=usable/accepted if accepted else None,
                eligible_actionable_recall=usable/actionable_gold if actionable_gold else None,
                hallucinations=hallucinations, unsafe_acceptance=unsafe,
                usable_source_updates=usable, usable_world_updates=None,
                world_truth='ungraded_without_independent_asof_evidence',
                missed_actionable=actionable_gold-usable,
                actionable_gold=actionable_gold, predictions=len(pred),
                accepted=accepted, held=sum(not r['accepted'] for r in rows),
                relevant=labels['material'], relevance_correct=material == labels['material'] if material is not None else None,
                ungradable_fields=ungradable_fields, errors=list(errors), field_accuracy=fields, taxonomy=taxonomy)


def select_outcome(records, left, right, *, adjudicated=False, complete_cost=False):
    holdout = [r for r in records if r['split']=='holdout']
    interval = paired_intervals(records,left,right,'usable_source_updates')
    harms = {a:sum(r['arms'][a]['unsafe_acceptance'] for r in holdout) for a in (left,right)}
    if not adjudicated or not complete_cost or interval['families'] < 30:
        return dict(verdict='inconclusive', reason='adjudication/cost/minimum-family gate', harms=harms, interval=interval)
    if any(harms.values()):
        return dict(verdict='tradeoff_or_disqualified',reason='observed unsafe acceptance; no superiority claim',harms=harms,interval=interval)
    misses={a:sum(r['arms'][a]['missed_actionable'] for r in holdout) for a in (left,right)}
    better=interval['ci95'][0]>0 and misses[right]<=misses[left]
    return dict(verdict='bounded_source_fidelity_advantage' if better else 'inconclusive',
                preferred=right if better else None,harms=harms,missed_actionable=misses,interval=interval,
                limitations='No external truth, calibration, population safety or future-performance claim.')


def paired_intervals(records, left, right, metric, seed=20261019, draws=2000):
    """Equal weight per family, cluster bootstrap of paired family differences."""
    groups = {}
    for r in records:
        if r['split'] != 'holdout':
            continue
        family = groups.setdefault(r['family_id'], [])
        # All attempted posts stay in denominator, including zero/failed proposals.
        family.append(r['arms'][right][metric] - r['arms'][left][metric])
    values = [sum(v)/len(v) for v in groups.values()]
    if not values:
        return dict(families=0, mean_difference=None, ci95=None, verdict='inconclusive')
    rng = random.Random(seed)
    samples = sorted(sum(rng.choices(values, k=len(values)))/len(values) for _ in range(draws))
    return dict(families=len(values), mean_difference=sum(values)/len(values),
                ci95=[samples[int(draws*.025)], samples[min(draws-1, int(draws*.975))]],
                verdict='inconclusive', note='descriptive cluster interval; no superiority/safety claim from synthetic or small-N data')


def summarize(records):
    result={}
    for arm in ARMS:
        total={key:sum(r['arms'][arm][key] for r in records) for key in
               ('tp','fp','fn','hallucinations','unsafe_acceptance','usable_source_updates','missed_actionable',
                'actionable_gold','predictions','accepted','held','ungradable_fields')}
        total.update(posts=len(records),error_posts=sum(bool(r['arms'][arm]['errors']) for r in records),
                     relevant_posts=sum(r['arms'][arm]['relevant'] for r in records),
                     relevance_unknown=sum(r['arms'][arm]['relevance_correct'] is None for r in records),
                     relevance_correct=sum(r['arms'][arm]['relevance_correct'] is True for r in records),
                     world_truth='ungraded',actual_paid_cost_usd=None,latency_ms=None)
        for name,num,den in [('proposal_precision',total['tp'],total['tp']+total['fp']),
                             ('proposal_recall',total['tp'],total['tp']+total['fn']),
                             ('eligible_precision',total['usable_source_updates'],total['accepted']),
                             ('eligible_actionable_recall',total['usable_source_updates'],total['actionable_gold']),
                             ('proposal_eligibility_coverage',total['accepted'],total['predictions'])]:
            total[name]=num/den if den else None
        result[arm]=total
    return result


def run_offline(fixtures, rules_outputs):
    splits = freeze_splits([f['source'] for f in fixtures])
    records = []
    for f in fixtures:
        source, labels = f['source'], f['labels']
        if source['source_id'] not in rules_outputs:
            raise ValueError('missing actual rules output')
        r = normalize(source, rules_outputs[source['source_id']])
        x = normalize(source, f['mock_extraction'])
        rq, xq = qualify(source, r), qualify(source, x)
        arms = (rq, apply_decisions(rq, f['mock_decisions_rules']), xq, apply_decisions(xq, f['mock_decisions_extraction']))
        records.append(dict(source_id=source['source_id'], family_id=source['family_id'], split=splits[source['family_id']],
                            strata=f['strata'],
                            source_hash=digest(request_input(source)), labels_hash=digest(labels),
                            arms={arm: grade(source, labels, rows, (r if i < 2 else x)['material'], (r if i < 2 else x)['errors']) for i, (arm, rows) in enumerate(zip(ARMS, arms))}))
    return dict(status='offline_synthetic_controls_only', paid_requests=0, paid_usd='0.000000000',
                synthetic_replies=True, records=records, summary=summarize(records),
                strata={s:sum(s in r['strata'] for r in records) for s in sorted({s for r in records for s in r['strata']})},
                comparisons=[dict(left=a, right=b, metric=m, **paired_intervals(records, a, b, m))
                             for a, b in [('rules','rules_decisions'), ('rules','extraction'), ('extraction','extraction_decisions')]
                             for m in ('unsafe_acceptance','usable_source_updates','missed_actionable')],
                verdict='inconclusive; no empirical provider/model comparison executed')


def readiness():
    config = json.loads((ROOT/'protocol.json').read_text())
    return dict(paid_dispatch_enabled=False, paid_requests=0, spent_usd='0.00',
                blockers=config['paid_gates'],
                conditional_bundle_nano_usd=reservation('responses',4096,1024)+2*reservation('decisions',4096),
                authority='local preparation only; parent review required before paid work')


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('preflight')
    p = sub.add_parser('grade-offline')
    p.add_argument('--rules-output', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.command == 'preflight':
        print(json.dumps(readiness(), indent=2))
    else:
        fixtures = json.loads((ROOT/'fixtures.json').read_text())['fixtures']
        result = run_offline(fixtures, json.loads(args.rules_output.read_text()))
        # Exclusive creation: preserve earlier raw experiment evidence.
        with args.output.open('x') as out:
            json.dump(result, out, indent=2)
        print(canonical(dict(status=result['status'], posts=len(result['records']), paid_requests=0)))


if __name__ == '__main__':
    main()
