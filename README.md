# opencode-codex-provider

This repository contains the custom Codex provider plugin for the open source **opencode** CLI. 
It ships the streaming Codex MCP client, a setup script for patching the core opencode repo, and instructions for keeping the integration lightweight and reproducible.

Whilst this works it is a hack and should be treated as such!

## Why?

The primary motivation for this is to allow people to use Opencode with gtp-5-codex via an OpenAI Pro plan, rather than the PAYG API.

## Repository Layout

```
opencode-codex-provider/
├── codex-provider-core.patch    # small core hook for custom provider factories
├── index.ts                     # plugin entry point registering the provider
├── package.json                 # Bun/TypeScript package metadata
├── setup-codex-provider.sh      # helper script to patch & link the provider
└── src/                         # Codex MCP client + streaming helpers
```

The setup expects the workspace layout:

```
<workspace>/opencode
<workspace>/opencode-codex-provider
```

## Quick Start

1. **Install dependencies** inside `opencode` (if you haven’t already):
   ```bash
   cd <workspace>/opencode
   bun install
   ```

2. **Apply the patch and link the local package**:
   ```bash
   cd <workspace>/opencode-codex-provider
   ./setup-codex-provider.sh
   ```
   - Applies `codex-provider-core.patch` to `opencode/packages/opencode/src/provider/provider.ts`.
   - Adds `file:<workspace>/opencode-codex-provider` as a dependency of `packages/opencode`.
   - Ensures the workspace `opencode.json` includes `"opencode-codex-provider"` in the `plugin` array.

3. **Verify the integration**:
   ```bash
   cd <workspace>/opencode/opencode
   bun run dev --print-logs --log-level DEBUG run "hello"
   ```
   You should see log lines like `source=custom-factory` and streaming output from the Codex MCP client.

## Updating or Re-applying

If you ever reset the `opencode` repo or pull a new version:

```bash
cd <workspace>/opencode-codex-provider
./setup-codex-provider.sh
```

The script is idempotent—it skips the patch if it’s already applied and simply relinks the workspace package.

## Removing the Integration

1. Revert the patch inside the `opencode` repo:
   ```bash
   cd <workspace>/opencode/opencode
   git checkout -- packages/opencode/src/provider/provider.ts
   ```
2. Remove the local dependency and plugin entry if desired.

## License

This repository follows the same licensing terms as the upstream opencode project unless stated otherwise.
