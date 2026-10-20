"""Compact offline inventory; output only paths, hashes, symbols, line evidence, and review classifications."""
import json,re,pathlib,collections
lane=pathlib.Path(__file__).parent
inv=json.loads((lane/'source-inventory.json').read_text()); reach=json.loads((lane/'reachable-calls.json').read_text()); rm={r['path']:r for r in reach}
read_rpcs={'get_connected_account_tokens_secure','get_skaters_avg_stats','get_unupdated_games_for_season','list_draft_pro_saved_drafts','read_draft_pro_private_import_blob','read_draft_pro_private_import_upload','read_draft_pro_snapshot','read_forge_game_revisions','read_starter_board_operational_events','read_starter_board_validation','read_tweet_claim_dated_roster','read_yahoo_player_overlay_as_of','search_fhfh_draft_players','roster_schedule_observation_clock'}

def effect(c):
 e,p=c['expr'],c['path']
 if e.endswith('.rpc'):return 'READ_RPC' if c.get('arg') in read_rpcs else 'RPC_NAMED_DISPATCH' if c.get('arg') else 'RPC_DYNAMIC_EFFECT_UNKNOWN'
 if re.search(r'\.(insert|upsert|update|delete|upload|remove)$',e):
  if re.search(r'createHash|createHmac|\.searchParams\.|\.headers\.',e,re.I):return None
  if re.search(r'\.(delete)$',e) and not re.search(r'(^query\.|\.from\(\)\.|resolvedClient|client\.storage)',e):return None
  return 'WRITE'
 if p=='web/pages/api/createComment.ts' and e=='client.create':return 'WRITE_SANITY'
 if re.search(r'(^|\.)(fetch|fetchImpl)$|^Fetch$|^axios\.(get|post|request)$',e):return 'HTTP'
 if (p,c['line'])==('web/lib/integrations/yahoo/oauth.ts',171):return 'HTTP'
 if re.search(r'^(stripe\.(checkout|charges|paymentIntents|prices)|sheets\.spreadsheets\.|yahoo\.(team|user|league)\.|yf\.games\.|resend\.emails\.send)',e):return 'PROVIDER_SDK'
 return None
sites={}
for r in reach:
 for c in r['calls']:
  k=effect(c)
  if k:sites[(c['path'],c['line'],c['expr'])]={**c,'kind':k}
sorted_sites=sorted(sites.items()); keys={k:f'E{i:04}' for i,(k,c) in enumerate(sorted_sites,1)}
for k,c in sorted_sites:c['id']=keys[k]

def guard(r):
 p=r['path'];s=pathlib.Path(p).read_text();gs=r['guards']; out='public'
 if 'requireApiUser' in [g['expr'] for g in gs]:out='user bearer/getUser'
 if 'adminOnly' in [g['expr'] for g in gs]:out='admin role OR cron; loopback development exception'
 if any('withOperationalRouteAuth' in g['expr'] for g in gs):out='outer admin/cron; method bound before audit'
 if any('playerForecastAdminOnly' in g['expr'] for g in gs):out='admin/cron + forecast runtime boundary'
 if any('playerForecastSeasonEditorOnlyMiddleware' in i['spec'] for i in r['imports']):out='verified user + sole editor allowlist + admin + runtime boundary'
 if p.endswith('/draft-ranker/community.ts'):out='optional user bearer; public aggregate branch'
 if p.endswith('/db/player-name-aliases.ts'):out='scoped signed review token OR admin/cron'
 if p.endswith('/player-forecasts/conflicts.ts'):out='scoped signed review token OR admin/cron; runtime boundary'
 if p.endswith('/forge/roster-events.ts'):out='public GET; admin/cron mutation branch'
 if p.endswith('/sustainability/leaderboard.ts'):out='public aggregate; admin/cron components branch'
 if p.endswith('/sustainability/trend-bands.ts'):out='public reads; admin/cron recompute branch'
 if p.endswith('/trends/player-trends.ts'):out='public GET; constant-time cron bearer POST'
 if '/internal/' in p and any(x in p for x in ['espn-sync','fantrax-sync','forecast-calendar','starter-board','sync-yahoo-players-to-sheet','yahoo-live-draft','cron-auth-check']):out='nonempty cron secret bearer'
 if '/mock-draft/' in p:out='public aggregate RPC (feature gated)' if p.endswith('/adp.ts') else 'factory user bearer/getUser (feature/capability gates)'
 if '/sources/ifttt/' in p:out='factory shared receiver secret (constant-time); intake policy'
 if p.endswith('/account/yahoo/callback.ts'):out='single-use state + browser cookie binding + PKCE transaction'
 if p.endswith('/account/patreon/callback.ts'):out='signed expiring state; no browser/session binding (F4)'
 if p.endswith('/webhooks/patreon.ts'):out='raw-body Patreon HMAC signature'
 if p.endswith('/webhooks/stripe.ts'):out='raw-body Stripe signature'
 if p.endswith('/roster-schedule-optimizer/diagnostic.ts'):out='development + loopback peer/local host'
 outer=bool(re.search(r'export\s+default\s+withCronJobAudit\s*\(',s))
 if outer:out+='; A! unauthenticated audit insert (F2)'
 return out,outer

rows=[];counts=collections.Counter()
for r in inv['routes']:
 p=r['path'];cand=[]
 for c in rm[p]['calls']:
  k=(c['path'],c['line'],c['expr'])
  if k in keys and keys[k] not in cand:cand.append(keys[k])
 gd,outer=guard(r);site_byid={c['id']:c for c in sites.values()}; kinds={site_byid[e]['kind'] for e in cand}
 # The generic mock factory contains mutually exclusive action bodies; prune by the fixed route action.
 if p.endswith('/mock-draft/adp.ts'):
  cand=[];kinds={'READ_RPC'}
  note='Fixed adp action returns before user-access/mutation branches; mock_draft_adp is stable SQL SELECT.'
 elif p.endswith('/mock-draft/access.ts'):
  cand=[e for e in cand if site_byid[e]['path']!='web/lib/mockDraft/api.ts'];kinds={site_byid[e]['kind'] for e in cand};note='Access resolution may synchronize owner grants/Patreon; no session-register action.'
 else:note=''
 if outer:kinds.add('AUDIT_WRITE_PUBLIC')
 if p.endswith('/createComment.ts'):note='Intentional anonymous comment submission; field validation only in source.'
 if p.endswith('/roster-schedule-optimizer/diagnostic-context.ts'):note='Authenticated diagnostic reads; hash.update is not a database write.'
 if p.endswith('/db/skaterArray.ts') or p.endswith('/db/update-nhl-edge-teams.ts') or p.endswith('/db/update-power-rankings.ts') or p.endswith('/db/update-team-power-ratings-new.ts') or p.endswith('/ml/create-materialized-view.ts'):note='Inert compatibility/quarantine response; no database/provider work.'
 if not kinds:kind='READ/LOCAL_OR_INERT'
 else:kind=','.join(sorted(kinds))
 counts[kind]+=1
 methods=','.join(x for x in r['methods'] if x in {'GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'}) or '*'
 if '/mock-draft/' in p:methods='GET' if p.endswith('/adp.ts') else 'DELETE' if p.endswith('/contributions.ts') else 'POST'
 anchors='; '.join(f"{g['expr']}:{g['line']}" for g in r['guards']) or '; '.join(f"{i['spec']}:{i['line']}" for i in r['imports'] if any(v in i['spec'] for v in ['mockDraft/api','lineSourceIftttReceiver','Middleware'])) or 'handler source'
 rows.append({'path':p,'sha256':r['sha256'],'methodsObserved':methods,'guard':gd,'guardEvidence':anchors,'effectSites':cand,'classification':kind,'note':note})
header='''# Complete API route inventory\n\nSource snapshot: 357 files under `web/pages/api/**`, including `.js`; local source only. Every file is represented once below. SHA-256, imports, and module edges are in `source-inventory.json`. Reviewed effect sites are deduplicated in `effect-sites.json`; the route-to-site relation is in `route-classifications.json`. No source bodies or generic literal/credential values are retained.\n\n`WRITE` denotes a reachable database/storage mutation candidate; `RPC_NAMED_DISPATCH` records a fixed non-reader RPC dispatch; `RPC_DYNAMIC_EFFECT_UNKNOWN` is an unresolved computed RPC name, not proof of a write. `HTTP`/`PROVIDER_SDK` includes internal HTTP and external provider calls; Supabase auth/database transport is represented by auth/read/write instead of provider HTTP. `READ_RPC` includes specifically reviewed readers. `READ/LOCAL_OR_INERT` has no mutation/provider-call site in the reviewed handler/helper closure. Branches and injected dependencies are conservative; site presence does not mean every request executes it. `A!` identifies the confirmed outer-audit authorization-order issue. Method literals are handler observations, not all enforcement guarantees; `*` means no explicit route method check found. Operational wrapper contract methods take precedence over legacy inner method literals.\n\nFactory dispatch was expanded for mock-draft, IFTTT, operational routes, and forecast editor wrappers. Fixed `adp` and `access` actions are pruned explicitly. Local Map/Set/cache deletion and crypto hash update are excluded from database writes. Public Start Chart/FORGE/RSO reader RPCs were checked against local SQL bodies; no hosted schema parity is claimed. Read-only import closure alone was never treated as proof of an active write.\n\nFor all rows with user bearer, guard implementation is `web/lib/api/requireApiUser.ts:20-43`; for admin/cron, `web/utils/adminOnlyMiddleware.ts:15-63` and `:66-130`. Public audit writes occur after rejected requests at `web/lib/cron/withCronJobAudit.ts:262,367-369`; this is independent of guarded business work.\n\n| # | Route source (prefix `web/pages/api/`) | Method literals | Guard / authorization | Effects / dispatch | Evidence / note |\n| --- | --- | --- | --- | --- | --- |\n'''
lines=[]
for i,r in enumerate(rows,1):
 evidence=r['guardEvidence']
 if r['effectSites']:evidence+='; '+','.join(r['effectSites'])
 if r['note']:evidence+='; '+r['note']
 lines.append(f"| {i} | `{r['path'].removeprefix('web/pages/api/')}` | {r['methodsObserved']} | {r['guard']} | {r['classification']} | {evidence} |")
(lane/'API-ROUTE-INVENTORY.md').write_text(header+'\n'.join(lines)+'\n')
(lane/'effect-sites.json').write_text(json.dumps([c for _,c in sorted_sites],separators=(',',':'))+'\n')
(lane/'route-classifications.json').write_text(json.dumps(rows,separators=(',',':'))+'\n')
# Remove duplicated transitive closures while retaining unique module evidence.
compact={'routeCount':len(rows),'moduleCount':len(inv['modules']),'routes':[{'path':r['path'],'sha256':r['sha256'],'imports':r['imports'],'guards':r['guards'],'methods':r['methods']} for r in inv['routes']],'modules':[{k:v for k,v in m.items() if k != 'calls'} for m in inv['modules']]}
(lane/'source-inventory.json').write_text(json.dumps(compact,separators=(',',':'))+'\n')
print(json.dumps({'routes':len(rows),'modules':len(inv['modules']),'effectSites':len(sites),'outerAuditRoutes':sum(guard(r)[1] for r in inv['routes'])}))
