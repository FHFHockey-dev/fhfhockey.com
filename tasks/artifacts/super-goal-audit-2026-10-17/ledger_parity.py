"""Offline mechanical audit of the Super Goal master task list (read-only).

1. Parity: every imported ledger row against the current state of its source checklist.
2. Evidence: backticked repository paths, commit SHAs and migration names cited by completed rows.
Writes JSON + a short summary to the output directory given as argv[1].
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
MASTER = REPO / "tasks/TASKS/super-goal/tasks-prd-fhfh-comprehensive-completion-audit-optimization.md"
LEDGER_ROW = re.compile(r"^- \[( |x)\] `SRC::(?P<path>[^`]+?)::C(?P<n>\d+)`(?: \((?P<orig>[^)]*)\))? — (?P<text>.*)$")
CHECKBOX = re.compile(r"^\s*[-*] \[( |x|X)\] (.*)$")
MASTER_ROW = re.compile(r"^\s*- \[( |x)\] (?P<id>\d+(?:\.\d+)*) (?P<text>.*)$")
TICK = re.compile(r"`([^`\n]{3,200})`")
PATH_ROOTS = ("web/", "tasks/", "supabase/", "migrations/", "sql/", "functions/", "cms/", "webhooks/", "modeling/", "scripts/", ".github/")
SHA = re.compile(r"^[0-9a-f]{7,40}$")
MIGRATION = re.compile(r"^(\d{14})_[A-Za-z0-9_]+(?:\.sql)?$")


def norm(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


TASK_NUMBER = re.compile(r"^(?:\*\*)?((?:NEW[- ])?(?:[A-Z]{1,4}-)?\d+(?:\.\d+)*[a-z]?)")


def number(text: str) -> str | None:
    match = TASK_NUMBER.match(text)
    return match.group(1) if match else None


def source_rows(path: Path) -> list[tuple[bool, str]]:
    rows = []
    for line in path.read_text(errors="replace").splitlines():
        match = CHECKBOX.match(line)
        if match:
            rows.append((match.group(1).lower() == "x", norm(match.group(2))))
    return rows


def git_has(sha: str, cache: dict[str, bool]) -> bool:
    if sha not in cache:
        cache[sha] = subprocess.run(["git", "-C", str(REPO), "cat-file", "-e", f"{sha}^{{commit}}"],
                                    capture_output=True).returncode == 0
    return cache[sha]


def main(out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    lines = MASTER.read_text().splitlines()
    ledger_start = next(i for i, line in enumerate(lines) if line.startswith("## Imported Source Checkbox Ledger"))
    master = [m.groupdict() | {"done": m.group(1) == "x", "line": i + 1}
              for i, line in enumerate(lines[:ledger_start]) if (m := MASTER_ROW.match(line))]
    ledger = [m.groupdict() | {"done": m.group(1) == "x", "line": i + 1}
              for i, line in enumerate(lines[ledger_start:], ledger_start) if (m := LEDGER_ROW.match(line))]

    by_source: dict[str, list[dict]] = defaultdict(list)
    for row in ledger:
        by_source[row["path"]].append(row)
    parity, findings = {}, []
    for rel, rows in by_source.items():
        path = REPO / rel
        if not path.exists():
            parity[rel] = {"status": "source_missing", "ledgerRows": len(rows), "ledgerDone": sum(r["done"] for r in rows)}
            findings += [{"kind": "source_missing", "source": rel, "id": f'C{r["n"]}', "line": r["line"], "ledgerDone": r["done"]} for r in rows]
            continue
        current = source_rows(path)
        texts = defaultdict(list)
        for index, (done, text) in enumerate(current):
            texts[text].append(index)
        used, counts = set(), Counter()
        for row in rows:
            text, ordinal = norm(row["text"]), int(row["n"]) - 1
            key = number(text)
            if ordinal < len(current) and current[ordinal][1] == text and ordinal not in used:
                index, how = ordinal, "ordinal"
            elif (candidates := [i for i in texts.get(text, []) if i not in used]):
                index, how = candidates[0], "moved"
            elif key and ordinal < len(current) and ordinal not in used and number(current[ordinal][1]) == key:
                index, how = ordinal, "ordinal_number"
            elif key and (numbered := [i for i, (_, t) in enumerate(current) if i not in used and number(t) == key]):
                index, how = numbered[0], "moved_number"
            else:
                prefix = text[:80]
                fuzzy = [i for i, (_, t) in enumerate(current) if i not in used and t[:80] == prefix]
                index, how = (fuzzy[0], "text_drift") if fuzzy else (None, "not_in_source")
            if index is not None:
                used.add(index)
                if current[index][0] != row["done"]:
                    how = "state_mismatch"
                    findings.append({"kind": "state_mismatch", "source": rel, "id": f'C{row["n"]}', "line": row["line"],
                                     "ledgerDone": row["done"], "sourceDone": current[index][0], "text": text[:160]})
            if how in ("not_in_source", "text_drift"):
                findings.append({"kind": how, "source": rel, "id": f'C{row["n"]}', "line": row["line"],
                                 "ledgerDone": row["done"], "text": text[:160]})
            counts[how] += 1
        extra = [(i, current[i]) for i in range(len(current)) if i not in used]
        for i, (done, text) in extra:
            findings.append({"kind": "source_only", "source": rel, "sourceOrdinal": i + 1, "sourceDone": done, "text": text[:160]})
        parity[rel] = {"status": "present", "ledgerRows": len(rows), "sourceRows": len(current),
                       "ledgerDone": sum(r["done"] for r in rows), "sourceDone": sum(d for d, _ in current),
                       "match": dict(counts), "sourceOnly": len(extra), "sourceOnlyOpen": sum(not d for _, (d, _) in extra)}

    # Evidence cited by completed rows (master tasks + ledger).
    completed = [("master", r["id"], r["line"], r["text"]) for r in master if r["done"]] + \
                [("ledger", f'{r["path"]}::C{r["n"]}', r["line"], r["text"]) for r in ledger if r["done"]]
    sha_cache, migrations = {}, {p.name.split("_")[0] for d in ("supabase/migrations", "migrations", "web/supabase/migrations")
                                  if (REPO / d).exists() for p in (REPO / d).rglob("*.sql")}
    evidence = Counter()
    broken = []
    for kind, ident, line, text in completed:
        for token in TICK.findall(text):
            token = token.strip().rstrip(".,;")
            if token.startswith(PATH_ROOTS) and not any(c in token for c in "*{}<> "):
                target = re.sub(r":\d+(?:-\d+)?$", "", token).rstrip("/")
                evidence["paths"] += 1
                if not (REPO / target).exists():
                    evidence["pathsMissing"] += 1
                    broken.append({"kind": "path_missing", "row": ident, "line": line, "token": token})
            elif SHA.match(token) and re.search(r"[a-f]", token) and re.search(r"\d", token):
                evidence["shas"] += 1
                if not git_has(token, sha_cache):
                    evidence["shasMissing"] += 1
                    broken.append({"kind": "sha_missing", "row": ident, "line": line, "token": token})
            elif (m := MIGRATION.match(token)):
                evidence["migrations"] += 1
                if m.group(1) not in migrations:
                    evidence["migrationsMissing"] += 1
                    broken.append({"kind": "migration_file_missing", "row": ident, "line": line, "token": token})
            elif token.startswith("dpl_"):
                evidence["deploymentIds"] += 1

    summary = {
        "master": {"rows": len(master), "done": sum(r["done"] for r in master), "open": sum(not r["done"] for r in master)},
        "ledger": {"rows": len(ledger), "done": sum(r["done"] for r in ledger), "open": sum(not r["done"] for r in ledger),
                   "sources": len(by_source)},
        "parityFindings": dict(Counter(f["kind"] for f in findings)),
        "parityFindingsOnCompletedRows": dict(Counter(f["kind"] for f in findings if f.get("ledgerDone"))),
        "evidence": dict(evidence),
        "brokenEvidenceRows": len({b["row"] for b in broken}),
    }
    (out / "parity.json").write_text(json.dumps({"summary": summary, "sources": parity, "findings": findings}, indent=1))
    (out / "evidence.json").write_text(json.dumps({"summary": dict(evidence), "broken": broken}, indent=1))
    (out / "master-rows.json").write_text(json.dumps(master, indent=1))
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main(Path(sys.argv[1]))
