# Blinded source adjudication sheet

Read PROTOCOL.md first. Review every proposal, including apparently exact matches. No model identities, lexical scores or benchmark answers are supplied. Missing arms remain missing.

## S01

**S01 — @ethan_sears**

https://x.com/ethan_sears/status/2105434001074962845

Publication: 2026-09-30T23:05:57.000Z; receipt: 2026-09-30T23:17:40.673936+00:00.

```text
Ilya Sorokin leads the Islanders out for warmups at Scotiabank Arena. Anthony Stolarz for the Leafs.
```

Available context and retained relationships (unverified hints are not identity proof):

```json
{
  "records": [
    {
      "record_id": "S01",
      "identity_hints": []
    }
  ],
  "relations": [],
  "context": {
    "status": "retained_source_only; roster hints unverified; no canonical IDs or game bindings",
    "independent_evidence": []
  }
}
```

Arm availability: {"Arm-A": "retained output", "Arm-B": "retained output", "Arm-C": "retained output", "Arm-D": "retained output"}

### S01-P001

[{"neutral_arm": "Arm-A", "variant": "raw"}, {"neutral_arm": "Arm-B", "variant": "raw"}]

```json
{
  "certainty": "observation",
  "condition": null,
  "event": "attendance",
  "evidence": {
    "end": 59,
    "start": 0,
    "text": "Ilya Sorokin leads the Islanders out for warmups at Scotiabank Arena."
  },
  "player": "Ilya Sorokin",
  "player_id": null,
  "polarity": "positive",
  "role": null,
  "source_author": "@ethan_sears",
  "source_id": "x:2105434001074962845",
  "team": "Islanders",
  "time": "warmups",
  "value": "leads the Islanders out for warmups"
}
```

Verdict: ___; error categories: ___; exact source quotation: ___; reason/missing context: ___.

### S01-P002

[{"neutral_arm": "Arm-A", "variant": "raw"}, {"neutral_arm": "Arm-B", "variant": "raw"}]

```json
{
  "certainty": "asserted",
  "condition": null,
  "event": "starter",
  "evidence": {
    "end": 92,
    "start": 60,
    "text": "Anthony Stolarz for the Leafs."
  },
  "player": "Anthony Stolarz",
  "player_id": null,
  "polarity": "positive",
  "role": null,
  "source_author": "@ethan_sears",
  "source_id": "x:2105434001074962845",
  "team": "Leafs",
  "time": null,
  "value": "for the Leafs"
}
```

Verdict: ___; error categories: ___; exact source quotation: ___; reason/missing context: ___.

### S01-P003

[{"neutral_arm": "Arm-A", "variant": "aligned"}, {"neutral_arm": "Arm-B", "variant": "aligned"}]

```json
{
  "certainty": "observation",
  "condition": null,
  "event": "attendance",
  "evidence": {
    "start": 0,
    "end": 69,
    "text": "Ilya Sorokin leads the Islanders out for warmups at Scotiabank Arena."
  },
  "player": "Ilya Sorokin",
  "player_id": null,
  "polarity": "positive",
  "role": null,
  "source_author": "@ethan_sears",
  "source_id": "x:2105434001074962845",
  "team": "Islanders",
  "time": "warmups",
  "value": "leads the Islanders out for warmups"
}
```

Verdict: ___; error categories: ___; exact source quotation: ___; reason/missing context: ___.

### S01-P004

[{"neutral_arm": "Arm-A", "variant": "aligned"}, {"neutral_arm": "Arm-B", "variant": "aligned"}]

```json
{
  "certainty": "asserted",
  "condition": null,
  "event": "starter",
  "evidence": {
    "start": 70,
    "end": 100,
    "text": "Anthony Stolarz for the Leafs."
  },
  "player": "Anthony Stolarz",
  "player_id": null,
  "polarity": "positive",
  "role": null,
  "source_author": "@ethan_sears",
  "source_id": "x:2105434001074962845",
  "team": "Leafs",
  "time": null,
  "value": "for the Leafs"
}
```

Verdict: ___; error categories: ___; exact source quotation: ___; reason/missing context: ___.

Missing source-supported updates: ___. Whole-set source support per neutral arm: supported / unsupported / unresolved / missing. Group fully reviewed: yes / no.
