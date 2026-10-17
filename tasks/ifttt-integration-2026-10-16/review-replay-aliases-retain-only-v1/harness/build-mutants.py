# Builds route copies under ../mutants/<name>/replay-player-aliases.ts from the LIVE route (read-only) and the owner's before/ copy.
# Each edit must match exactly once. Writes ../mutants/mutants-manifest.json (name -> description, expectation, sha256).
# Run: python3 -I harness/build-mutants.py   (from the review folder)
import hashlib, json, os, sys

here = os.path.dirname(os.path.abspath(__file__))
review = os.path.dirname(here)
repo = os.path.abspath(os.path.join(review, "..", "..", ".."))
live = open(os.path.join(repo, "web/pages/api/v1/db/replay-player-aliases.ts"), encoding="utf-8").read()
before = open(os.path.join(review, "..", "replay-aliases-retain-only-v1/before/replay-player-aliases.ts"), encoding="utf-8").read()

GUARD = "        if (isCurrent && (currentCalls >= 2 || iftttIntakePilotConfigured())) break;\n"
CONSUMED = "        consumed++;\n        const seasonId"
SKIP_HIST = "        if (!isCurrent) continue;\n"

mutants = {
    "control-after": ("Live route bytes, unchanged (harness control)", "survive", []),
    "before-head": ("Owner before/ copy = git HEAD:replay-player-aliases.ts", "killed", None),
    "guard-removed": ("Condition reverted to `isCurrent && currentCalls >= 2` (import kept)", "killed",
                      [(GUARD, "        if (isCurrent && currentCalls >= 2) break;\n")]),
    "guard-after-consumed": ("Pilot stop moved to just after `consumed++`", "killed",
                             [(GUARD, "        if (isCurrent && currentCalls >= 2) break;\n"),
                              (CONSUMED, "        consumed++;\n        if (isCurrent && iftttIntakePilotConfigured()) break;\n        const seasonId")]),
    "guard-all-rows": ("Pilot stop applied to historical rows too", "killed",
                       [(GUARD, "        if ((isCurrent && currentCalls >= 2) || iftttIntakePilotConfigured()) break;\n")]),
    "guard-inverted": ("Pilot condition negated", "killed",
                       [(GUARD, "        if (isCurrent && (currentCalls >= 2 || !iftttIntakePilotConfigured())) break;\n")]),
    "guard-flag-only": ("Pilot test narrowed to IFTTT_RECEIPT_VARIANTS_ENABLED === 'true' (misses a stopped pilot)", "killed",
                        [(GUARD, "        if (isCurrent && (currentCalls >= 2 || process.env.IFTTT_RECEIPT_VARIANTS_ENABLED === \"true\")) break;\n")]),
    "guard-skip-fetch-only": ("Row consumed and resolved; only the processor POST is skipped under pilot", "killed",
                              [(GUARD, "        if (isCurrent && currentCalls >= 2) break;\n"),
                               (SKIP_HIST, "        if (!isCurrent || iftttIntakePilotConfigured()) continue;\n")]),
    "guard-continue": ("Current-day row skipped with `continue` instead of `break` (cursor can pass it)", "see note",
                       [(GUARD, "        if (isCurrent && currentCalls >= 2) break;\n        if (isCurrent && iftttIntakePilotConfigured()) continue;\n")]),
}

manifest = {}
for name, (description, expectation, edits) in mutants.items():
    if edits is None:
        text = before
    else:
        text = live
        for old, new in edits:
            count = text.count(old)
            if count != 1:
                sys.exit(f"{name}: expected exactly one match, found {count}: {old!r}")
            text = text.replace(old, new)
    out = os.path.join(review, "mutants", name)
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, "replay-player-aliases.ts"), "w", encoding="utf-8") as handle:
        handle.write(text)
    manifest[name] = {"description": description, "expectation": expectation,
                      "sha256": hashlib.sha256(text.encode("utf-8")).hexdigest()}
with open(os.path.join(review, "mutants", "mutants-manifest.json"), "w", encoding="utf-8") as handle:
    json.dump(manifest, handle, indent=1)
    handle.write("\n")
print(json.dumps(manifest, indent=1))
