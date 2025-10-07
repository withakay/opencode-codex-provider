#!/usr/bin/env bash
set -euo pipefail
set -x
# This script builds a custom version of the opencode binary with the "-codex" suffix,
# runs the standard publish script, and then replaces the cached binary with the newly built one.

# Get the root of the opencode monorepo
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENCODE_REPO_ROOT="$SCRIPT_DIR/../opencode"

# --- 1. Determine version ---
echo "--- Determining version ---"
cd "$OPENCODE_REPO_ROOT"



# Get the current version and append the suffix
CURRENT_VERSION=0.14.6
if [ -z "$CURRENT_VERSION" ]; then
    echo "Error: Failed to get current opencode version. Make sure dependencies are installed."
    exit 1
fi
export OPENCODE_VERSION="${CURRENT_VERSION}-codex"
echo "Setting OPENCODE_VERSION to: $OPENCODE_VERSION"


# --- 2. Run the main publish script ---
echo -e "\n--- Running publish script ---"
# This script handles version bumping, building, and running `bun install`
./script/publish.ts


# --- 3. Find and extract the new binary ---
echo -e "\n--- Finding new binary ---"
DIST_DIR="$OPENCODE_REPO_ROOT/packages/opencode/dist"
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
if [ "$ARCH" == "x86_64" ]; then
  ARCH="x64"
fi

# Find the zip artifact created by the publish script
ZIP_FILE="$DIST_DIR/opencode-$OS-$ARCH.zip"
if [ ! -f "$ZIP_FILE" ]; then
    echo "Warning: Could not find specific zip artifact: $ZIP_FILE"
    ZIP_FILE=$(find "$DIST_DIR" -name "opencode-*.zip" | head -n 1)
    if [ -z "$ZIP_FILE" ]; then
        echo "Error: Could not find any zip artifact in $DIST_DIR"
        exit 1
    fi
fi
echo "Found artifact: $ZIP_FILE"

# Unzip to a temporary directory
TMP_DIR=$(mktemp -d)
echo "Unzipping to $TMP_DIR"
unzip -o "$ZIP_FILE" -d "$TMP_DIR"
NEW_BINARY_PATH="$TMP_DIR/opencode"

if [ ! -f "$NEW_BINARY_PATH" ]; then
    echo "Error: 'opencode' binary not found in the zip artifact."
    rm -rf "$TMP_DIR"
    exit 1
fi
chmod +x "$NEW_BINARY_PATH"
echo "Extracted new binary: $NEW_BINARY_PATH"


# --- 4. Find the bun cache location for the binary ---
echo -e "\n--- Finding bun cache location ---"
# `bun which` points to the symlink that bun uses to run the command.
TARGET_EXEC_PATH=$(bun which opencode)
if [ -z "$TARGET_EXEC_PATH" ]; then
    echo "Error: 'bun which opencode' did not return a path. The new version may not be installed correctly."
    rm -rf "$TMP_DIR"
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

# Clean up
rm -rf "$TMP_DIR"

echo -e "\n--- Done ---"
echo "Successfully replaced the cached opencode binary with the custom-built version."
