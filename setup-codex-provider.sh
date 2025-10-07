#!/usr/bin/env bash
set -euo pipefail

PROVIDER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$PROVIDER_DIR/.." && pwd)"
OPENCODE_REPO="$WORKSPACE_ROOT/opencode"
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

echo "[codex-provider] applying core patch"
cd "$OPENCODE_REPO"
apply_patch "$PATCH_FILE"

echo "[codex-provider] linking local package"
cd "$OPENCODE_REPO/packages/opencode"
bun add "$LOCAL_PACKAGE_REF" >/dev/null

update_config() {
  local target="$1"
  [[ -f "$target" ]] || return
  node - "$target" <<'NODE'
const fs = require("fs")
const path = process.argv[2]
const text = fs.readFileSync(path, "utf8")
const config = JSON.parse(text)
config.plugin = Array.from(new Set([...(config.plugin ?? []), "opencode-codex-provider"]))
fs.writeFileSync(path, JSON.stringify(config, null, 2))
NODE
  echo "[codex-provider] ensured plugin entry in $target"
}

update_config "$WORKSPACE_ROOT/opencode.json"

echo "[codex-provider] all done – run \"bun run dev --print-logs --log-level DEBUG run 'hello'\" to verify"
