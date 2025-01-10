# my-app

An Electron application with Svelte and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode)

## Project Setup

### Install

```bash
# Regular install
$ bun install

# For detailed progress
$ bun install --verbose
```

> **Note:** Some steps (especially native module compilation) may take several minutes. The `--verbose` flag will show you the detailed progress.

Common time-consuming steps:

- Native module compilation (like `better-sqlite3-multiple-ciphers`)
- Electron download and setup
- Post-install scripts

If you suspect the process is truly stuck (no CPU usage for >5 minutes), you can:

1. Cancel the process (Ctrl+C)
2. Clear the cache: `bun pm cache clean`
3. Remove existing dependencies and lock files:

   ```bash
   # For Unix/Linux/macOS (bash)
     rm -rf node_modules
     rm bun.lockb

   # For Windows (PowerShell)
     Remove-Item -Recurse -Force node_modules
     Remove-Item bun.lockb

   # For Windows (CMD)
     rmdir /s /q node_modules
     del bun.lockb
   ```

4. Try again with verbose logging: `bun install --verbose`

### Development

```bash
$ bun run dev
```

### Build

```bash
# For windows
$ bun run build:win

# For macOS
$ bun run build:mac

# For Linux
$ bun run build:linux
```
