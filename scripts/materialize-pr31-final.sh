#!/usr/bin/env bash
set -euo pipefail

readonly payload=/tmp/pr31-payload.b64
readonly script=scripts/apply-pr31-final.py
readonly payload_sha=6248edd96a856f8a59b05b8ac5cc8294ff3d8219eb13c20b2a4d23e6858b0022
readonly script_sha=6a95d924a4d0051c3db738f1e126776a51f3ab8185231cc24c49a7d7fa3a0d0d

cat scripts/apply-pr31-final.py.gz.b64.[0-9][0-9] > "$payload"
printf '%s  %s\n' "$payload_sha" "$payload" | sha256sum --check
base64 --decode "$payload" | gzip --decompress > "$script"
printf '%s  %s\n' "$script_sha" "$script" | sha256sum --check
python3 -m py_compile "$script"
