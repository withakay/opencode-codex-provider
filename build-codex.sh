#!/usr/bin/env bash
set -euo pipefail

# This script builds a custom version of the opencode binary with the "-codex" suffix
# and replaces the currently cached binary with the newly built one.

# Get the root of the opencode monorepo
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENCODE_REPO_ROOT="$SCRIPT_DIR/../opencode"

# --- 1. Determine version ---
echo "--- Determining version ---"
cd "$OPENCODE_REPO_ROOT"

# Find the opencode executable
OPENCODE_EXEC="opencode"
if [ -f "./node_modules/.bin/opencode" ]; then
  OPENCODE_EXEC="./node_modules/.bin/opencode"
fi

# Get the current version and append the suffix
CURRENT_VERSION=$($OPENCODE_EXEC --version)
if [ -z "$CURRENT_VERSION" ]; then
    echo "Error: Failed to get current opencode version. Make sure dependencies are installed."
    exit 1
fi
export OPENCODE_VERSION="${CURRENT_VERSION}-codex"
echo "Setting OPENCODE_VERSION to: $OPENCODE_VERSION"


# --- 2. Run the build script ---
echo -e "\n--- Running build script ---"
# Run the build script for the opencode package
./packages/opencode/script/build.ts


# --- 3. Find the new binary ---
echo -e "\n--- Finding new binary ---"
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
if [ "$ARCH" == "x86_64" ]; then
  ARCH="x64"
fi

# The build script places the binary in a nested dist folder
NEW_BINARY_PATH="$OPENCODE_REPO_ROOT/packages/opencode/dist/opencode-$OS-$ARCH/bin/opencode"

if [ ! -f "$NEW_BINARY_PATH" ]; then
    echo "Error: Could not find new binary at $NEW_BINARY_PATH"
    exit 1
fi
echo "Found new binary: $NEW_BINARY_PATH"


# --- 4. Find the bun cache location for the binary ---
echo -e "\n--- Finding bun cache location ---"
# Ensure dependencies are installed so `bun which` works
echo "Running bun install to ensure workspace is set up..."
bun install > /dev/null

TARGET_EXEC_PATH=$(which opencode)
if [ -z "$TARGET_EXEC_PATH" ]; then
    echo "Error: 'bun which opencode' did not return a path. The opencode package may not be installed correctly."
    exit 1
fi
echo "Found target executable symlink: $TARGET_EXEC_PATH"

# The path from `bun which` is a symlink; resolve it to the real binary path in the cache.
if [ ! -L "$TARGET_EXEC_PATH" ]; then
    echo "Warning: Target executable is not a symlink. Overwriting in-place."
    TARGET_BINARY_PATH=$TARGET_EXEC_PATH
else
    TARGET_BINARY_PATH=$(readlink "$TARGET_EXEC_PATH")
    # Handle relative symlink paths
    if [[ "$TARGET_BINARY_PATH" != /* ]]; then
        TARGET_BINARY_PATH="$(dirname "$TARGET_EXEC_PATH")/$TARGET_BINARY_PATH"
    fi
    echo "Resolved symlink to real binary: $TARGET_BINARY_PATH"
fi


# --- 5. Copy the new binary over the cached one ---
echo -e "\n--- Copying binary ---"
echo "Source:      $NEW_BINARY_PATH"
echo "Destination: $TARGET_BINARY_PATH"
cp "$NEW_BINARY_PATH" "$TARGET_BINARY_PATH"

echo -e "\n--- Done ---"
echo "Successfully replaced the cached opencode binary with the custom-built version."
