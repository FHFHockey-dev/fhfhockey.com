#!/bin/sh
# Regenerates the offline RFC 3161 test fixtures (test-only CA; never a trust anchor in production).
set -eu
OUT="$1"; W="$(mktemp -d)"; cd "$W"
cat > tsa.cnf <<'CNF'
[ tsa ]
default_tsa = tsa_config
[ tsa_config ]
dir = .
serial = ./tsaserial
crypto_device = builtin
signer_cert = ./tsa.crt
certs = ./ca.crt
signer_key = ./tsa.key
signer_digest = sha256
default_policy = 1.3.6.1.4.1.99999.1
other_policies = 1.3.6.1.4.1.99999.2
digests = sha256
accuracy = secs:1, millisecs:500
ordering = no
tsa_name = no
ess_cert_id_chain = no
ess_cert_id_alg = sha256
[ tsa_noacc ]
dir = .
serial = ./tsaserial
signer_cert = ./tsa.crt
certs = ./ca.crt
signer_key = ./tsa.key
signer_digest = sha256
default_policy = 1.3.6.1.4.1.99999.1
digests = sha256
ess_cert_id_alg = sha256
[ ext_tsa ]
basicConstraints = critical,CA:false
keyUsage = critical,digitalSignature
extendedKeyUsage = critical,timeStamping
[ ext_plain ]
basicConstraints = critical,CA:false
keyUsage = critical,digitalSignature
[ ext_ca ]
basicConstraints = critical,CA:true
keyUsage = critical,keyCertSign
CNF
echo 01 > tsaserial
# A fixed validity window (2020-2100) keeps the fixtures independent of the day they were generated.
cat >> tsa.cnf <<'CNF'
[ ca ]
default_ca = test_ca
[ test_ca ]
dir = .
database = ./index.txt
new_certs_dir = ./issued
serial = ./caserial
default_md = sha256
policy = policy_any
unique_subject = no
copy_extensions = none
[ policy_any ]
commonName = supplied
CNF
mkdir issued; : > index.txt; echo 1000 > caserial
START=20200101000000Z; END=21000101000000Z
for root in ca other; do
  openssl req -new -newkey rsa:2048 -nodes -keyout $root.key -out $root.csr -subj "/CN=FHFH Test $root Root" 2>/dev/null
  openssl ca -batch -notext -selfsign -config tsa.cnf -keyfile $root.key -in $root.csr -out $root.crt \
    -startdate $START -enddate $END -extensions ext_ca 2>/dev/null
done
# Cross-signed form of the test CA: same subject and key, issued by the other root (like DigiCert's bundled cross-signed G4).
openssl req -new -key ca.key -out ca-cross.csr -subj "/CN=FHFH Test ca Root" 2>/dev/null
openssl ca -batch -notext -config tsa.cnf -cert other.crt -keyfile other.key -in ca-cross.csr -out ca-cross.crt \
  -startdate $START -enddate $END -extensions ext_ca -extfile tsa.cnf 2>/dev/null
for name in tsa plain; do
  openssl req -new -newkey rsa:2048 -nodes -keyout $name.key -out $name.csr -subj "/CN=FHFH Test $name" 2>/dev/null
  openssl ca -batch -notext -config tsa.cnf -cert ca.crt -keyfile ca.key -in $name.csr -out $name.crt \
    -startdate $START -enddate $END -extensions ext_$name -extfile tsa.cnf 2>/dev/null
done
printf 'packet-bytes' > data.bin
openssl ts -query -data data.bin -sha256 -cert -no_nonce -out q_nononce.tsq 2>/dev/null
openssl ts -query -data data.bin -sha256 -cert -out q.tsq 2>/dev/null
openssl ts -reply -config tsa.cnf -section tsa_config -queryfile q.tsq -out good.tsr 2>/dev/null
openssl ts -reply -config tsa.cnf -section tsa_noacc -queryfile q.tsq -out noacc.tsr 2>/dev/null
openssl ts -reply -config tsa.cnf -section tsa_config -queryfile q.tsq -signer plain.crt -inkey plain.key -out plain.tsr 2>/dev/null || true
openssl ts -query -in q.tsq -text 2>/dev/null | sed -n 's/.*Nonce: //p' > nonce.txt
mkdir -p "$OUT"; cp ca.crt ca-cross.crt other.crt tsa.crt tsa.key plain.crt plain.key good.tsr noacc.tsr data.bin nonce.txt "$OUT"/
[ -s plain.tsr ] && cp plain.tsr "$OUT"/ || true
rm -rf "$W"
