#!/usr/bin/env bash
# Publish all @pmp/* packages to npm in dependency order.
#
# Usage:
#   ./scripts/publish-all.sh           # publish current versions
#   ./scripts/publish-all.sh --dry-run # show what would publish, don't actually
#
# Requires:
#   - npm login completed (npm whoami works)
#   - membership in the @pmp org (npm org ls pmp)
#   - 2FA OTP available (you'll be prompted thrice)
#
# Order: @pmp/tokenization → @pmp/sdk → @pmp/conformance.

set -euo pipefail

cd "$(dirname "$0")/.."

DRY_RUN=""
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN="--dry-run"
  echo "(dry-run mode — no actual publish)"
  echo ""
fi

# Pre-flight: ensure logged in
if ! npm whoami >/dev/null 2>&1; then
  echo "✗ npm is not logged in. Run: npm login --scope=@pmp --auth-type=web" >&2
  exit 1
fi
WHOAMI=$(npm whoami)
echo "Publishing as: $WHOAMI"
echo ""

PACKAGES=("tokenization" "sdk" "conformance")
PROPAGATION_WAIT=30   # seconds between publishes for npm to propagate

for i in "${!PACKAGES[@]}"; do
  pkg="${PACKAGES[$i]}"
  dir="packages/$pkg"

  echo "─────────────────────────────────────────────────────"
  echo "  @pmp/$pkg  ($((i+1))/${#PACKAGES[@]})"
  echo "─────────────────────────────────────────────────────"

  if [[ ! -d "$dir" ]]; then
    echo "✗ $dir does not exist" >&2
    exit 1
  fi

  (
    cd "$dir"

    echo "→ npm install"
    npm install --silent

    echo "→ dry-run pack (this is what npm publish will upload)"
    npm pack --dry-run 2>&1 | grep -E "npm notice" | tail -15

    if [[ -z "$DRY_RUN" ]]; then
      echo "→ npm publish (enter OTP when prompted)"
      npm publish
    else
      echo "→ npm publish --dry-run"
      npm publish --dry-run
    fi
  )

  if [[ -z "$DRY_RUN" ]] && (( i < ${#PACKAGES[@]} - 1 )); then
    echo ""
    echo "→ waiting ${PROPAGATION_WAIT}s for npm propagation before next publish…"
    sleep "$PROPAGATION_WAIT"
  fi
  echo ""
done

echo "─────────────────────────────────────────────────────"
echo "  ✓ all packages published"
echo "─────────────────────────────────────────────────────"
echo ""
echo "Verify:"
echo "  npm view @pmp/tokenization version"
echo "  npm view @pmp/sdk version"
echo "  npm view @pmp/conformance version"
echo ""
echo "Try the published CLI:"
echo "  npx @pmp/conformance https://clude.io"
