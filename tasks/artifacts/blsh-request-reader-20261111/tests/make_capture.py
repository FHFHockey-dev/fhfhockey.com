"""TEST-ONLY: writes offline_fixture captures from the fake DB into a scratch dir (never into the artifact folder).
    make_capture.py <scratch>   ->  <scratch>/cap-full, <scratch>/cap-no-nst-1111
"""
import asyncio
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE.parent), str(HERE)]
import capture_reader as c   # noqa: E402
import fake_db as f          # noqa: E402

scratch = Path(sys.argv[1])
c.utc_now = f.fixed_clock()
full = f.FakeDB()
no_nst = f.FakeDB({**full.data, 'individual': [r for r in full.data['individual'] if r['date_scraped'] != '2026-11-11'],
                   'onIce': [r for r in full.data['onIce'] if r['date_scraped'] != '2026-11-11']})
report = {}
for name, db in (('cap-full', full), ('cap-no-nst-1111', no_nst)):
    r = asyncio.run(c.capture(f.FakeSession(db), scratch / name))
    report[name] = {'state': r['state'], 'rows': r.get('rows'), 'queriesDispatched': r['queriesDispatched']}
print(json.dumps(report))
sys.exit(0 if all(v['state'] == 'OFFLINE_CAPTURE_SIMULATION_COMPLETE' for v in report.values()) else 1)
