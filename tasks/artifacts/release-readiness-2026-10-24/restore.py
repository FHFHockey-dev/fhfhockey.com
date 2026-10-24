"""Restore the exact candidate to a new directory; no Git or service operation."""
from pathlib import Path
import hashlib,json,sys,tarfile
O=Path(__file__).resolve().parent;M=json.loads((O/'CANDIDATE.json').read_text());dest=Path(sys.argv[1]).resolve();archive=O/'candidate-source.tar.gz'
assert not dest.exists(),'destination must be new'
assert hashlib.sha256(archive.read_bytes()).hexdigest()==M['archiveSha256']
dest.mkdir(parents=True)
with tarfile.open(archive) as t:
 for m in t.getmembers():assert m.isfile() and not m.name.startswith('/') and '..' not in Path(m.name).parts,m.name
 t.extractall(dest,filter='data')
for n,h in M['files'].items():assert hashlib.sha256((dest/n).read_bytes()).hexdigest()==h,n
print(json.dumps({'snapshot':str(dest),'verifiedFiles':len(M['files']),'contentTreeSha256':M['contentTreeSha256'],'dependencies':'Use the existing matching Node22.11.0/npm10.9.0 installation; node_modules, environment and credentials are not archived.'},indent=2))
