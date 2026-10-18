#!/bin/bash
set -e
S=/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/78b48495-ea87-4c55-991b-6cd888eecbdd/scratchpad/s08
R=/Users/tim/Code/fhfhockey.com
D=$R/tasks/artifacts/security-candidates-2026-10-17
A="web/lib/NHL/corsProxy.ts web/lib/NHL/corsProxy.test.ts web/__tests__/pages/api/cors.test.ts"
B="web/utils/adminOnlyMiddleware.ts web/__tests__/utils/adminOnlyMiddleware.test.ts"
C="web/utils/adminOnlyMiddleware.ts web/__tests__/utils/adminOnlyMiddleware.test.ts web/__tests__/pages/api/v1/db/cron-auth-boundaries.test.ts web/__tests__/pages/api/v1/db/operational-route-auth.test.ts"
G=$S/repo; rm -rf $G; cp -R $S/base $G; cd $G
git init -q && git -c user.name=x -c user.email=x@x add -A && git -c user.name=x -c user.email=x@x commit -qm base
# Stage A: current bytes of A files
for f in $A; do cp $R/$f $G/$f; done
git diff --full-index -- $A > $D/1-proxy-redirect.patch
git -c user.name=x -c user.email=x@x commit -qam A
# Stage B: relay-only admin files from the earlier B patch
for f in $B; do cp $S/stageB/$f $G/$f; done
git diff --full-index -- $B > $D/2-admin-relay.patch
git -c user.name=x -c user.email=x@x commit -qam B
# Stage C: current bytes
for f in $C; do cp $R/$f $G/$f; done
git diff --full-index -- $C > $D/3-admin-role-binding.patch
git -c user.name=x -c user.email=x@x commit -qam C
# Verification: fresh copy of ceceb407a bytes, apply 1,2,3 in order, compare to working tree
V=$S/verify; rm -rf $V; cp -R $S/base $V; cd $V
for p in 1-proxy-redirect 2-admin-relay 3-admin-role-binding; do git apply --check $D/$p.patch && git apply $D/$p.patch && echo "applied $p"; done
ok=1
for f in $A $C; do
  a=$(shasum -a 256 $V/$f | cut -d' ' -f1); b=$(shasum -a 256 $R/$f | cut -d' ' -f1)
  [ "$a" = "$b" ] && echo "MATCH $a $f" || { echo "DIFF $f"; ok=0; }
done
echo all_match=$ok
