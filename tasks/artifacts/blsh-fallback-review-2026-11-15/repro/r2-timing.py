"""R2: re-derive the 11-18 timing verdict from the code rules (no repo imports).
preparation.ts:48     need(date < today && now - eventMs < 8 * DAY)
gate :210/:212/:215   eventRecent = UTC-midnight(asOf) - Date(record.date) <= maxEventAgeDays (7, retained policy)
gate :211/:213-214    asOf - earliest(native, frame, calendar/wgo/group captures) <= maxCaptureAgeHours (24)
gate :252             windows: (evaluationDate - latestDate)/1d <= maxEventAgeDays
Run: python3 -I r2-timing.py"""
from datetime import datetime as D, timedelta as T, timezone
U = timezone.utc
src = D(2026, 11, 11, tzinfo=U); slot = D(2026, 11, 18, 14, 5, tzinfo=U); cap_end = slot + T(minutes=2)  # 120 s capture bound
print("capture age at slot:", slot - src, "| 8-day margin:", src + T(days=8) - slot)
def event_recent(asof): return (D(asof.year, asof.month, asof.day, tzinfo=U) - src) <= T(days=7)
def capture_ok(asof, earliest): return asof - earliest <= T(hours=24)
for asof in [D(2026, 11, 18, 20, tzinfo=U), D(2026, 11, 18, 23, 59, 59, 999000, tzinfo=U), D(2026, 11, 19, tzinfo=U)]:
    print(asof.isoformat(), "eventRecent", event_recent(asof), "captureAge<=24h", capture_ok(asof, slot))
print("usable window after capture end:", D(2026, 11, 19, tzinfo=U) - cap_end, "(date rule binds; 24h rule would allow to", (slot + T(hours=24)).isoformat(), ")")
