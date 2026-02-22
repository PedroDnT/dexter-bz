#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: ./scripts/safe-apply-patch.sh <patch-file>

Safely applies a git patch with guardrails:
1) Detects if patch is already applied (exits 0)
2) Applies normally when cleanly applicable
3) Falls back to 3-way apply for context drift
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -ne 1 ]]; then
  usage
  exit 1
fi

patch_file="$1"

if [[ ! -f "$patch_file" ]]; then
  echo "Error: patch file not found: $patch_file" >&2
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: current directory is not a git repository." >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: working tree is not clean. Commit or stash changes first." >&2
  exit 1
fi

if git apply --reverse --check "$patch_file" >/dev/null 2>&1; then
  echo "Patch already applied. Skipping."
  exit 0
fi

if git apply --check "$patch_file" >/dev/null 2>&1; then
  git apply --index "$patch_file"
  echo "Patch applied successfully (clean apply)."
  exit 0
fi

if git apply --3way --index "$patch_file"; then
  echo "Patch applied successfully with 3-way merge."
  exit 0
fi

echo "Failed to apply patch. Resolve conflicts, then run:"
echo "  git status"
echo "  git diff --name-only --diff-filter=U"
exit 1
