"""Consolidate already-reviewed finding records; does not run app code."""
import csv
import json
import re
from pathlib import Path

BASE = Path(__file__).parent
items = json.loads((BASE / "finding-catalog-working.json").read_text())

def section(report, line):
    lines = (BASE / report).read_text().splitlines()
    start = line - 1
    level = len(re.match(r"#+", lines[start]).group()) if lines[start].startswith("#") else 6
    end = start + 1
    while end < len(lines):
        m = re.match(r"(#+) ", lines[end])
        if m and len(m.group(1)) <= level:
            break
        end += 1
    return "\n".join(lines[start:end]).strip()

for item in items:
    headings = [c for c in item["candidates"] if c["kind"] == "heading"]
    if headings:
        # A named original finding wins over an inherited mention in a later test/script.
        item["primary"] = headings[0]
        item["primary"]["excerpt"] = section(headings[0]["report"], headings[0]["line"])
    elif item["primary"]["kind"] == "bullet":
        item["primary"]["excerpt"] = item["primary"]["excerpt"].split("\n\n")[0]
    elif item["primary"]["kind"] == "paragraph" and item["id"] != "AFULL-TEST-01":
        text = item["primary"]["excerpt"]
        first = text.split("\n\n")[0]
        correction = re.search(r"(?:Proposed correction|Suggested fix)[^\n]*", text)
        item["primary"]["excerpt"] = first + ("\n\n" + correction.group() if correction and correction.group() not in first else "")
    item["needs_editorial_review"] = False

for report in sorted(BASE.glob("batch-runners-*.md")):
    for i, line in enumerate(report.read_text().splitlines(), 1):
        m = re.match(r"^#{2,3} (AFULL-OPS-\d+) .*?\b(P[012])\b", line)
        if m:
            items.append({"id": m[1], "severity": m[2], "ledger_paths": [], "needs_editorial_review": False,
                          "primary": {"report": report.name, "line": i, "kind": "heading", "excerpt": section(report.name, i)}})
assert len(items) == 417 and len({x["id"] for x in items}) == 417
items.sort(key=lambda x: (x["severity"], x["id"]))

def cells(line):
    return [x.strip() for x in re.split(r"(?<!\\)\|", line.strip().strip("|"))]

def escape(text):
    return text.replace("|", "&#124;").replace("\n", "<br>")

rows = ["| ID | Severity | Frozen location / evidence record | Complete finding: checked claim, evidence, wrong result and minimal scenario, suggested fix, affected readers |",
        "|---|---|---|---|"]
for item in items:
    p = item["primary"]
    text = p["excerpt"].strip()
    if p["kind"] == "table":
        source = (BASE / p["report"]).read_text().splitlines()
        start = p["line"] - 1
        while start > 0 and source[start-1].startswith("|"):
            start -= 1
        headings, values = cells(source[start]), cells(text)
        assert len(headings) == len(values), item["id"]
        text = "\n".join(f"**{h}:** {v}" for h, v in zip(headings[1:], values[1:]))
    else:
        text = re.sub(r"^#{1,6} ", "", text)
    source = f"[{p['report']}:{p['line']}](astra-full-audit-20261114/{p['report']})"
    if item["ledger_paths"]:
        source += "<br>" + "<br>".join(f"`{path}`" for path in item["ledger_paths"])
    rows.append(f"| {item['id']} | {item['severity']} | {source} | {escape(text)} |")
(BASE / "finding-catalog.json").write_text(json.dumps(items, indent=2) + "\n")
(BASE / "findings-table.md").write_text("\n".join(rows) + "\n")
print(json.dumps({"findings": len(items), "P1": sum(x['severity']=='P1' for x in items), "P2": sum(x['severity']=='P2' for x in items)}))
