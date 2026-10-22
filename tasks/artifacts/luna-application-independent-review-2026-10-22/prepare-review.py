from pathlib import Path
import json,hashlib,shutil,subprocess,tempfile
repo=Path('/Users/tim/Code/fhfhockey.com')
out=repo/'tasks/artifacts/luna-application-independent-review-2026-10-22'
owner=repo/'tasks/artifacts/luna-application-contracts-2026-10-22'
scratch=Path(tempfile.mkdtemp(prefix='fhfh-luna-contract-independent-'))
candidate=json.loads((owner/'CANDIDATE.json').read_text())
patch=owner/'application.patch'
subprocess.run(['git','apply','--check',str(patch)],cwd=scratch,check=True)
subprocess.run(['git','apply',str(patch)],cwd=scratch,check=True)
paths=[x['path'] for x in candidate['files']]
for x in candidate['files']:
 assert hashlib.sha256((scratch/x['path']).read_bytes()).hexdigest()==x['sha256'], x['path']
extras=['web/lib/projections/evidenceTime.ts','web/lib/supabase/pagination.ts','web/lib/sources/playerIdentity.ts','web/lib/sources/playerIdentitySnapshot.ts','web/lib/sources/tweetIdentityCandidates.ts','web/lib/sources/tweetIdentityProposal.ts','web/lib/sources/tweetNewsPhraseDictionary.ts','web/lib/sources/fixtures/tweetIdentityOfflineFixture.ts','web/lib/sources/fixtures/iftttComparisonObservations.json','web/package.json','web/tsconfig.json','web/eslint.config.mjs']
for rel in extras:
 target=scratch/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(repo/rel,target)
(scratch/'web/node_modules').symlink_to(repo/'web/node_modules',target_is_directory=True)
config='''import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root:fileURLToPath(new URL('.',import.meta.url)), envDir:false,
  resolve:{alias:{lib:fileURLToPath(new URL('./lib',import.meta.url))}},
  cacheDir:fileURLToPath(new URL('./.review-cache',import.meta.url)),
  test:{environment:'node',include:['lib/sources/*.test.ts'],minWorkers:1,maxWorkers:1},
});
'''
(scratch/'web/review.vitest.config.mjs').write_text(config)
(out/'review.vitest.config.mjs').write_text(config)
config=json.loads((repo/'web/tsconfig.json').read_text());config['compilerOptions']['target']='ES2022';config['compilerOptions']['types']=['node'];config['include']=[p.removeprefix('web/') for p in paths if p.endswith('.ts')];config['exclude']=[]
(scratch/'web/review.tsconfig.json').write_text(json.dumps(config,indent=2)+'\n')
(out/'review.tsconfig.json').write_text(json.dumps(config,indent=2)+'\n')
rows=[]
for rel in paths+extras:
 source=hashlib.sha256((repo/rel).read_bytes()).hexdigest();copy=hashlib.sha256((scratch/rel).read_bytes()).hexdigest();assert source==copy
 rows.append({'path':rel,'sourceSha256':source,'snapshotSha256':copy})
(out/'snapshot.json').write_text(json.dumps({'scratch':str(scratch),'files':rows},indent=2)+'\n')
(out/'scratch-path.txt').write_text(str(scratch)+'\n')
print(json.dumps({'scratch':str(scratch),'pinned_files':len(rows),'patch_reconstructed_files':len(paths)}))
