#!/usr/bin/env bash
# Checks whether design/ds-bot-patches.patch still applies to <ref>.
#
#   tools/patch-conflict-check.sh <upstream-ref>
#
# Prints "clean" and exits 0 when the whole patch applies, otherwise lists the
# conflicting files and exits 1. Run before merging an upstream upgrade.
set -euo pipefail

if [ "$#" -ne 1 ] || [ -z "$1" ]; then
  echo "usage: $0 <ref>" >&2
  exit 2
fi

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
patch="$root/design/ds-bot-patches.patch"
ref=$1

if ! git -C "$root" rev-parse --verify --quiet "$ref^{commit}" >/dev/null; then
  echo "not a commit: $ref" >&2
  exit 2
fi

tmp=$(mktemp -d "${TMPDIR:-/tmp}/patch-conflict-check.XXXXXX")
wt="$tmp/tree"

cleanup() {
  git -C "$root" worktree remove --force "$wt" >/dev/null 2>&1 || true
  git -C "$root" worktree prune >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT

git -C "$root" worktree add --detach --quiet "$wt" "$ref"

if git -C "$wt" apply --check "$patch" >/dev/null 2>&1; then
  echo clean
  exit 0
fi

# The whole patch failed; check file by file to name what conflicts.
mkdir -p "$tmp/parts"
awk -v dir="$tmp/parts" '
  /^diff --git / { n++; out = sprintf("%s/%03d.patch", dir, n) }
  out != "" { print > out }
' "$patch"

failed=0
for part in "$tmp/parts"/*.patch; do
  if ! git -C "$wt" apply --check "$part" >/dev/null 2>&1; then
    sed -n 's|^+++ b/||p; s|^--- a/||p' "$part" | head -1
    failed=1
  fi
done

if [ "$failed" -eq 0 ]; then
  # Conflicts only appear for the patch as a whole (overlapping hunks).
  echo "conflict: whole patch does not apply, per-file checks pass" >&2
fi

exit 1
