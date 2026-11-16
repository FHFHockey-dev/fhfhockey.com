#!/bin/sh
# RECHECK-10 custody probe through the production frames CLI of a scratch mirror (G4 list = [aa8a9cb7…]).
# Inputs: a hand-built acquisition dir (the suite's acq-cand: fixture facts + the REAL tool bytes) and its conversion.
# Usage: sh custody-probe.sh <mirror bridge dir> <suite scratch dir holding conv-cand + acq-cand> <out scratch>
set -u
B=$1; T=$2; O=$3; rm -rf "$O"; mkdir -p "$O"
cli() { node "$B/frames.mjs" --conversion "$T/conv-cand" --acquisition "$1" --out "$2" | tail -1 | cut -c1-200; }
cp -R "$T/acq-cand" "$O/acq-real"; chmod -R u+w "$O/acq-real"
echo "1) hand-written facts + real tool bytes: $(cli "$O/acq-real" "$O/frames-real")"
[ -f "$O/frames-real/FRAMES.json" ] && node -e 'const f=require(process.argv[1]);console.log("   FRAMES mode:",f.mode,"| receipt classes:",[...new Set((f.frames||[]).map(x=>x.provenance&&x.provenance.receiptClass))].join(","))' "$O/frames-real/FRAMES.json"
mkdir "$O/existing"; echo x > "$O/existing/keep.txt"
echo "2) same input, existing --out: $(cli "$O/acq-real" "$O/existing") | contents: $(ls "$O/existing")"
cp -R "$T/acq-cand" "$O/acq-flip"; chmod -R u+w "$O/acq-flip"; F="$O/acq-flip/source-tool.mjs"
node -e 'const fs=require("fs"),p=process.argv[1],b=fs.readFileSync(p);b[b.length-1]=0x20;fs.writeFileSync(p,b)' "$F"
node --input-type=module -e "import {resealAcquisition} from '$B/tests/fixtures.mjs'; resealAcquisition(process.argv[1]);" "$O/acq-flip" 2>/dev/null || node -e '
const fs=require("fs"),c=require("crypto"),d=process.argv[1],m=JSON.parse(fs.readFileSync(d+"/MANIFEST.json"));
m.files=fs.readdirSync(d).filter(n=>n!=="MANIFEST.json").sort().map(f=>{const b=fs.readFileSync(d+"/"+f);return{file:f,bytes:b.length,sha256:c.createHash("sha256").update(b).digest("hex")}});
fs.chmodSync(d+"/MANIFEST.json",0o600);fs.writeFileSync(d+"/MANIFEST.json",JSON.stringify(m,null,2)+"\n")' "$O/acq-flip"
echo "3) one-byte tool, runtime/launch still claim aa8a9cb7 (resealed): $(cli "$O/acq-flip" "$O/frames-flip")"
H=$(shasum -a 256 "$F" | cut -c1-64)
node -e 'const fs=require("fs"),p=process.argv[1]+"/ACQUISITION-RUNTIME.json",r=JSON.parse(fs.readFileSync(p));r.toolSHA256=process.argv[2];r.launch.entryScriptSHA256=process.argv[2];fs.chmodSync(p,0o600);fs.writeFileSync(p,JSON.stringify(r,null,2)+"\n")' "$O/acq-flip" "$H"
node --input-type=module -e "import {resealAcquisition} from '$B/tests/fixtures.mjs'; resealAcquisition(process.argv[1]);" "$O/acq-flip"
echo "4) one-byte tool with consistent runtime/launch hashes: $(cli "$O/acq-flip" "$O/frames-flip2")"
ls "$O" | grep -c '^frames-flip'
