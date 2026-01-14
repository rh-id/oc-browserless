# oc-browserless

[![npm version](https://badge.fury.io/js/oc-browserless.svg)](https://www.npmjs.com/package/oc-browserless)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Browserless plugin for OpenCode using puppeteer-core.

## Features

- **Web Browsing**: Navigate and browse web pages with content extraction and security certificate information
- **DuckDuckGo Search**: Search the web with raw HTML content
- **Screenshots**: Capture screenshots in PNG, JPEG, and WebP formats
- **PDF Generation**: Convert HTML or URLs to PDF documents
- **Browser Lifecycle Management**: Manual control over browser connections

## Installation

### Prerequisites

Install Bun if you haven't already:

```bash
curl -fsSL https://bun.sh/install | bash
```

After installation, restart your terminal or source your shell profile:

```bash
# For bash
source ~/.bashrc

# For zsh
source ~/.zshrc

# For fish
source ~/.config/fish/config.fish
```

Verify Bun installation:

```bash
bun --version
```

### Global Installation

```bash
npm install -g oc-browserless
```

### Project Installation

```bash
npm install oc-browserless
```

### Configuration

Add to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["oc-browserless"]
}
```

## Browserless Setup

### Local Browserless

**Using Docker:**

```bash
docker run -p 3000:3000 -e "CONCURRENT=10" browserless/chrome:latest
```

**Or install globally:**

```bash
npm install -g browserless
browserless --port=3000
```

Then set environment variable:

```bash
export BROWSERLESS_URL=ws://localhost:3000
```

### Remote Browserless

Sign up for [browserless.io](https://browserless.io/) and get your API key:

```bash
export BROWSERLESS_URL=wss://your-browserless-instance.com
export BROWSERLESS_API_KEY=your-api-key
```

### Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your browserless configuration:

```bash
BROWSERLESS_URL=ws://localhost:3000
BROWSERLESS_API_KEY=your-api-key-if-using-remote
```

## Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/rh-id/oc-browserless.git
cd oc-browserless
```

### 2. Install Dependencies

```bash
bun install
```

This will install:

- Runtime dependencies (`puppeteer-core`, `@opencode-ai/plugin`)
- Development dependencies (ESLint, Prettier, TypeScript)

### 3. Build Project

```bash
bun run build
```

This will:

1. Compile TypeScript files to JavaScript in `dist/` directory
2. Generate type declarations
3. Copy compiled files to `.opencode/` for local OpenCode testing

**Note**: The `.opencode/` directory is used for local development with OpenCode. When the package is published to npm, only the `dist/` directory is included.

### 4. Test with OpenCode

Run opencode in the project directory:

```bash
opencode
```

The plugin is automatically loaded from `.opencode/plugin/` directory.

## Project Structure

```
oc-browserless/
├── .github/workflows/           # CI/CD workflows
│   ├── build.yml               # Build and test
│   ├── lint.yml                # Linting and formatting
│   └── release.yml             # Automated releases
├── .husky/                    # Git hooks
│   └── pre-commit              # Pre-commit lint-staged
├── .opencode/                  # OpenCode plugin files (compiled for local dev)
│   ├── plugin/                 # Compiled plugin
│   │   └── browserless.js     # Plugin entry point (all code)
│   └── package.json           # Dependencies for local dev
├── dist/                       # Compiled output (published to npm)
│   └── plugin/
│       ├── browserless.js      # Compiled plugin
│       ├── browserless.d.ts    # Type declarations
│       ├── browserless.js.map  # Source map
│       └── browserless.d.ts.map # Type source map
├── scripts/                    # Build scripts
│   └── build-copy.js          # Build copy script
├── src/                        # Source code (TypeScript)
│   └── plugin/
│       └── browserless.ts     # Complete plugin (all code, ~613 lines)
├── Configuration Files
│   ├── .gitignore
│   ├── .gitattributes
│   ├── eslint.config.cjs
│   ├── .prettierrc
│   ├── .env.example
│   ├── .release-please-manifest.json
│   ├── opencode.json
│   ├── package.json
│   └── tsconfig.json
└── Documentation
    ├── README.md
    ├── CONTRIBUTING.md
    └── LICENSE
```

## Usage

The plugin provides the following tools for OpenCode:

### Browse Web Pages

```typescript
// Navigate to a URL and get content
{
  "tool": "browse",
  "args": {
    "url": "https://example.com"
  }
}
```

### DuckDuckGo Search

```typescript
// Search the web
{
  "tool": "search",
  "args": {
    "query": "TypeScript best practices"
  }
}
```

### Take Screenshot

```typescript
// Capture screenshot
{
  "tool": "screenshot",
  "args": {
    "url": "https://example.com",
    "path": "./screenshot.png",
    "format": "png",
    "fullPage": true
  }
}
```

### Generate PDF

```typescript
// Generate PDF from URL
{
  "tool": "pdf",
  "args": {
    "url": "https://example.com",
    "path": "./output.pdf",
    "format": "A4",
    "printBackground": true
  }
}

// Generate PDF from HTML
{
  "tool": "pdf",
  "args": {
    "html": "<html><body><h1>Hello World</h1></body></html>",
    "path": "./output.pdf"
  }
}
```

## Browser Lifecycle

All browser operations automatically manage their own connections:

- **No manual start/stop required** - tools handle this internally
- Each tool execution creates an isolated browser instance
- Browser sessions are **NOT** persistent across tool calls
- Browserless supports multiple concurrent connections automatically
- Each tool operates in isolation with no shared state
- No connection reuse - each operation creates fresh browser instance

## API Reference

### browse

Navigate to and browse web pages.

| Argument | Type   | Required | Default | Description        |
| -------- | ------ | -------- | ------- | ------------------ |
| url      | string | Yes      | -       | URL to navigate to |

**Returns:**

```json
{
  "success": true,
  "url": "https://example.com",
  "title": "Example Domain",
  "content": "<html>...</html>",
  "certificate": {
    "issuer": "CN=DigiCert Inc",
    "protocol": "TLS 1.3",
    "subjectName": "CN=example.com",
    "subjectAlternativeNames": ["example.com", "www.example.com"],
    "validFrom": 1234567890,
    "validTo": 1234567890
  }
}
```

The `certificate` field is `null` for HTTP connections or when security details are unavailable.

### search

Search using DuckDuckGo.

| Argument | Type   | Required | Default | Description  |
| -------- | ------ | -------- | ------- | ------------ |
| query    | string | Yes      | -       | Search query |

### screenshot

Capture page screenshots.

| Argument       | Type    | Required | Default | Description                   |
| -------------- | ------- | -------- | ------- | ----------------------------- |
| url            | string  | No       | -       | URL to screenshot             |
| path           | string  | No       | -       | Output file path              |
| format         | enum    | No       | png     | Format: png, jpeg, webp       |
| fullPage       | boolean | No       | false   | Full page screenshot          |
| quality        | number  | No       | -       | Quality for jpeg/webp (0-100) |
| viewportWidth  | number  | No       | -       | Viewport width                |
| viewportHeight | number  | No       | -       | Viewport height               |

### pdf

Generate PDF from HTML or URL.

| Argument        | Type    | Required | Default | Description       |
| --------------- | ------- | -------- | ------- | ----------------- |
| html            | string  | No\*     | -       | HTML content      |
| url             | string  | No\*     | -       | URL to convert    |
| path            | string  | No       | -       | Output file path  |
| format          | enum    | No       | A4      | Paper format      |
| printBackground | boolean | No       | true    | Print backgrounds |
| landscape       | boolean | No       | false   | Landscape mode    |
| marginTop       | string  | No       | 0cm     | Top margin        |
| marginBottom    | string  | No       | 0cm     | Bottom margin     |
| marginLeft      | string  | No       | 0cm     | Left margin       |
| marginRight     | string  | No       | 0cm     | Right margin      |

\*Either `html` or `url` is required.

## Development

```bash
# Install dependencies
bun install

# Build
bun run build

# Test
bun test

# Lint
bun run lint

# Format
bun run format
```

### Development Workflow

**Linting:**

```bash
bun run lint
```

**Auto-fix linting issues:**

```bash
bun run lint:fix
```

**Check formatting:**

```bash
bun run format:check
```

**Auto-fix formatting:**

```bash
bun run format
```

**Type checking:**

```bash
bunx tsc --noEmit
```

**Testing:**

```bash
bun test
```

## CI/CD

### Build Workflow

- Runs on push and PR
- Installs dependencies
- Builds project
- Uploads artifacts

### Lint Workflow

- Runs on push and PR
- Lints code with ESLint
- Checks formatting

### Release Workflow

- Runs on main branch
- Uses release-please for automated versioning
- Publishes to npm on release

## Versioning

Uses automated versioning with release-please:

- `feat:` → Minor version bump (1.x.0)
- `fix:` → Patch version bump (x.x.1)
- `BREAKING CHANGE:` → Major version bump (2.0.0)

## Troubleshooting

### Connection Issues

**Error**: "Failed to connect to browserless"

- Check `BROWSERLESS_URL` environment variable
- Ensure browserless instance is running
- Verify WebSocket URL is correct (use `ws://` or `wss://`)
- Verify firewall/network settings

**Verify browserless is running:**

```bash
curl http://localhost:3000/health
```

**Check WebSocket URL format:**

- Local: `ws://localhost:3000`
- Remote: `wss://your-browserless.com`

### Timeout Issues

**Error**: "Operation timed out"

- Increase timeout in browser options
- Check network connectivity
- Verify URL is accessible

### Browser Disconnected

**Error**: "Browser not connected" or connection failures

- Check `BROWSERLESS_URL` environment variable
- Ensure browserless instance is running
- Each tool creates its own connection - no manual management needed
- Try running the tool again if connection fails

### TypeScript Errors

If you see TypeScript errors about missing types:

**Before dependencies are installed (expected):**

1. `Cannot find module 'puppeteer-core'` → Run `bun install`
2. `Cannot find module '@opencode-ai/plugin'` → Run `bun install`
3. `Cannot find name 'setTimeout'` / `URL` / `process` / `fetch` → Will resolve after `bun install`

These are not actual errors - they're just TypeScript not being able to resolve types until dependencies are installed.

**After dependencies are installed:**

1. Restart your TypeScript server in your IDE
2. Clear Bun cache:

```bash
rm -rf node_modules
bun install
```

### Build Errors

If build fails:

1. Check TypeScript version:

```bash
bun --version
```

2. Update dependencies:

```bash
bun update
```

### Clean Scripts

The project includes several clean scripts for easy cleanup:

```bash
# Clean build output only
bun run clean

# Clean build output and dependencies
bun run clean:deps

# Clean build output and all dependencies
bun run clean:all

# Full reset: clean everything, reinstall dependencies, and rebuild
bun run reset
```

**Use these when:**

- `clean` - After making changes to TypeScript files
- `clean:deps` - When dependencies need reinstalling
- `clean:all` - When you want a fresh start
- `reset` - When troubleshooting build or cache issues

### Troubleshooting Build Issues

If you encounter build errors:

```bash
# Option 1: Full reset
bun run reset

# Option 2: Manual clean and rebuild
rm -rf dist
bun run build
```

## Donate / Sponsor

If you find this project useful and would like to support its continued development, consider making a donation or becoming a sponsor:

[https://teer.id/rh-id](https://teer.id/rh-id)

Your support helps maintain and improve the project. Thank you! ❤️

## License

MIT © [Ruby Hartono](https://github.com/rh-id)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please use the [GitHub Issues](https://github.com/rh-id/oc-browserless/issues) page.
