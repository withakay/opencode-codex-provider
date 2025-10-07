#!/usr/bin/env bash
set -euo pipefail

PROVIDER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$PROVIDER_DIR/.." && pwd)"
OPENCODE_REPO="$WORKSPACE_ROOT/opencode"
PATCH_TARGET="$OPENCODE_REPO/packages/opencode/src/provider/provider.ts"
PATCH_FILE="$PROVIDER_DIR/codex-provider-core.patch"
LOCAL_PACKAGE_REF="file:$PROVIDER_DIR"

apply_patch() {
  local patch_file="$1"
  if [[ ! -f "$patch_file" ]]; then
    echo "[codex-provider] missing patch $patch_file" >&2
    exit 1
  fi
  if patch --dry-run -p1 <"$patch_file" >/dev/null 2>&1; then
    patch -p1 <"$patch_file"
    echo "[codex-provider] applied $(basename "$patch_file")"
  else
    echo "[codex-provider] skipping $(basename "$patch_file") (already applied?)"
  fi
}

echo "[codex-provider] applying core patch $PATCH_FILE in $OPENCODE_REPO"
cd "$OPENCODE_REPO"
apply_patch "$PATCH_FILE"

echo "[codex-provider] linking local package"
cd "$OPENCODE_REPO/packages/opencode"

# Check if the package is already added
package_json="package.json"
if grep -q "opencode-codex-provider" "$package_json"; then
  echo "[codex-provider] package already exists in package.json, updating reference"
  # Update the existing reference to ensure it points to the current location
  node - "$package_json" "$LOCAL_PACKAGE_REF" <<'NODE'
const fs = require("fs")
const packagePath = process.argv[2]
const localRef = process.argv[3]
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"))

if (pkg.dependencies && pkg.dependencies["opencode-codex-provider"]) {
  pkg.dependencies["opencode-codex-provider"] = localRef
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2))
}
NODE
else
  echo "[codex-provider] adding new package reference"
  bun add "$LOCAL_PACKAGE_REF" >/dev/null
fi

update_config() {
  local target="$1"
  [[ -f "$target" ]] || return
  node - "$target" <<'NODE'
const fs = require("fs")
const path = process.argv[2]
const text = fs.readFileSync(path, "utf8")
const config = JSON.parse(text)

// Ensure plugin array exists and doesn't contain duplicates
const plugins = config.plugin ?? []
if (!plugins.includes("opencode-codex-provider")) {
  plugins.push("opencode-codex-provider")
  config.plugin = plugins
  fs.writeFileSync(path, JSON.stringify(config, null, 2))
  console.log("Added opencode-codex-provider to plugin list")
} else {
  console.log("opencode-codex-provider already in plugin list")
}
NODE
  echo "[codex-provider] ensured plugin entry in $target"
}

# Clean up lockfile if it has issues to prevent duplicate key errors
cd "$OPENCODE_REPO"
if [[ -f "bun.lock" ]]; then
  echo "[codex-provider] checking lockfile for issues"
  if bun install --dry-run 2>&1 | grep -q "Duplicate\|InvalidPackageKey"; then
    echo "[codex-provider] removing problematic lockfile"
    rm bun.lock
  fi
fi

# Regenerate lockfile cleanly
echo "[codex-provider] regenerating lockfile"
cd "$OPENCODE_REPO/packages/opencode"
bun install

update_config "$WORKSPACE_ROOT/opencode.json"

echo "[codex-provider] all done – run \"bun run dev --print-logs --log-level DEBUG run 'hello'\" to verify"
