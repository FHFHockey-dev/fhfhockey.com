#!/usr/bin/env python3
"""Independent cross-check of protocol.bootstrap (forge-qual-bootstrap-v1), written from the scope text, not from
metrics.mjs. Prints JSON goldens that metrics.test.mjs pins. Run: python3 -I reference_bootstrap.py

Arithmetic follows the protocol: IEEE-754 doubles, sums over rows sorted by (gameId, playerId), w * (d * d)."""
import hashlib
import json

M = (1 << 64) - 1


def splitmix64(seed):
    state = seed & M

    def nxt():
        nonlocal state
        state = (state + 0x9E3779B97F4A7C15) & M
        z = state
        z = ((z ^ (z >> 30)) * 0xBF58476D1CE4E5B9) & M
        z = ((z ^ (z >> 27)) * 0x94D049BB133111EB) & M
        return z ^ (z >> 31)
    return nxt


def xoshiro(seed):
    sm = splitmix64(seed)
    s = [sm(), sm(), sm(), sm()]

    def rotl(x, k):
        return ((x << k) | (x >> (64 - k))) & M

    def nxt():
        result = (rotl((s[1] * 5) & M, 7) * 9) & M
        t = (s[1] << 17) & M
        s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3]; s[2] ^= t; s[3] = rotl(s[3], 45)
        return result
    return nxt


def index(nxt, n):
    threshold = (1 << 64) - ((1 << 64) % n)
    while True:
        x = nxt()
        if x < threshold:
            return x % n


def q7(v, q):
    m = len(v)
    h = (m - 1) * q
    lo = int(h // 1)
    hi = min(lo + 1, m - 1)
    return v[lo] + (h - lo) * (v[hi] - v[lo])


def first16(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def bootstrap(rows, seed, replicates):
    rows = sorted(rows, key=lambda r: (r["gameId"], r["playerId"]))
    games = sorted({r["gameId"] for r in rows})
    players = sorted({r["playerId"] for r in rows})
    nxt = xoshiro(seed)
    values, non_finite = [], 0
    for _ in range(replicates):
        gc = [0] * len(games)
        pc = [0] * len(players)
        for _ in range(len(games)):
            gc[index(nxt, len(games))] += 1
        for _ in range(len(players)):
            pc[index(nxt, len(players))] += 1
        sf = 0.0
        sb = 0.0
        for r in rows:
            w = gc[games.index(r["gameId"])] * pc[players.index(r["playerId"])]
            if w == 0:
                continue
            df = r["predicted"] - r["actual"]
            db = r["baseline"] - r["actual"]
            sf += w * (df * df)
            sb += w * (db * db)
        if sb == 0:
            non_finite += 1
            continue
        values.append((sf - sb) / sb)
    values.sort()
    return {"nonFinite": non_finite, "finite": len(values), "lower": q7(values, 0.025), "upper": q7(values, 0.975)}


# The cross-check dataset (also in metrics.test.mjs): 3 games x 3 players, nine rows.
ROWS = [
    {"gameId": 2026020103, "playerId": 8470003, "predicted": 0.4, "baseline": 0.3, "actual": 1},
    {"gameId": 2026020101, "playerId": 8470001, "predicted": 2.6, "baseline": 2.1, "actual": 3},
    {"gameId": 2026020101, "playerId": 8470002, "predicted": 1.2, "baseline": 1.5, "actual": 0},
    {"gameId": 2026020101, "playerId": 8470003, "predicted": 0.9, "baseline": 0.8, "actual": 2},
    {"gameId": 2026020102, "playerId": 8470001, "predicted": 2.2, "baseline": 2.0, "actual": 1},
    {"gameId": 2026020102, "playerId": 8470002, "predicted": 1.7, "baseline": 1.4, "actual": 2},
    {"gameId": 2026020102, "playerId": 8470003, "predicted": 0.5, "baseline": 0.9, "actual": 0},
    {"gameId": 2026020103, "playerId": 8470001, "predicted": 3.1, "baseline": 2.4, "actual": 4},
    {"gameId": 2026020103, "playerId": 8470002, "predicted": 1.0, "baseline": 1.1, "actual": 1},
]

if __name__ == "__main__":
    base = first16("forge-qual-bootstrap-v1:dc9c87b78e56d67965353f8f11a55a8a60e659a1f8eff489dca29bbff4cf1a68")
    stream = first16(f"forge-qual-bootstrap-v1:{base}:SHOTS_ON_GOAL:final")
    first = xoshiro(int(base, 16))
    print(json.dumps({
        "baseSeedHex": base,
        "streamSeedHexSogFinal": stream,
        "firstOutputsBaseSeed": [str(first()) for _ in range(4)],
        "crossCheck": bootstrap(ROWS, int(stream, 16), 10000),
    }, indent=2))
