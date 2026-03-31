# xG Harness Enforcement

Date: `2026-03-31`
Task: `tasks-xg-baseline-follow-ups.md` `1.2`

## Purpose

Make the repaired baseline feature contract enforceable in generated artifacts, not just documented as policy.

## What Changed

### Dataset builder guard

The baseline dataset builder now rejects forbidden leaked feature inputs if they are forced back into runtime config.

Current forbidden input set:

- `shotEventType`

It also rejects generated encoded feature keys that use forbidden leakage prefixes.

Current forbidden encoded prefix set:

- `shotEventType:`

### Artifact generation guard

The baseline artifact builder now refuses to persist:

- `selectedFeatures.categorical` containing `shotEventType`
- encoded `featureKeys` containing any `shotEventType:*` entry

## Why This Matters

This prevents three failure modes:

1. accidental reintroduction of leaked features through future config edits
2. silent persistence of invalid artifacts even if the dataset layer is bypassed
3. confusing benchmark reruns where the docs say the leak is fixed but the saved artifact still contains leaked keys

## Verification

Focused regression coverage now proves:

- the dataset builder rejects forced `shotEventType` leakage
- the artifact builder rejects leaked `shotEventType` metadata
- the repaired default baseline feature set still builds valid dataset/model payloads
