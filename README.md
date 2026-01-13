# oc-browserless

[![npm version](https://badge.fury.io/js/oc-browserless.svg)](https://www.npmjs.com/package/oc-browserless)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Browserless plugin for OpenCode using puppeteer-core.

## Features

- **Web Browsing**: Navigate and browse web pages with content extraction
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

- Compile TypeScript files to JavaScript
- Generate type declarations
- Output to `dist/` directory

### 4. Test with OpenCode

Add to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["."]
}
```

Run opencode and test:

```bash
opencode
```

## Project Structure

```
oc-browserless/
├── .github/workflows/           # CI/CD workflows
│   ├── build.yml               # Build and test
│   ├── lint.yml                # Linting and formatting
│   └── release.yml             # Automated releases
├── .husky/                    # Git hooks
│   └── pre-commit              # Pre-commit lint-staged
├── .opencode/                  # OpenCode plugin files
│   └── tool/                  # Custom tools
│       ├── browse.ts            # Navigate and browse web pages
│       ├── search.ts            # DuckDuckGo search
│       ├── screenshot.ts        # Screenshot capture
│       ├── pdf.ts              # PDF generation
│       └── browser.ts         # Browser lifecycle management
├── src/                        # Source code
│   ├── browser/               # Browser management
│   │   └── manager.ts         # Browser instance manager
│   ├── plugin/                # Plugin hooks
│   │   └── browserless.ts    # Main plugin entry point
│   └── utils/                 # Utilities
│       └── common.ts           # Common utilities
├── Configuration Files
│   ├── .gitignore             # Git ignore rules
│   ├── .gitattributes         # Git attributes
│   ├── eslint.config.cjs       # ESLint configuration
│   ├── .prettierrc            # Prettier configuration
│   ├── .env.example            # Environment variables template
│   ├── .release-please-manifest.json  # Release configuration
│   ├── opencode.json           # OpenCode configuration
│   ├── package.json            # NPM package configuration
│   └── tsconfig.json          # TypeScript configuration
└── Documentation
    ├── README.md               # Main documentation
    ├── CONTRIBUTING.md         # Contributing guidelines
    └── LICENSE                # MIT License
```

## Usage

The plugin provides the following tools for OpenCode:

### Browse Web Pages

```typescript
// Navigate to a URL and get content
{
  "tool": "browse",
  "args": {
    "url": "https://example.com",
    "waitForSelector": ".content",
    "extractContent": true
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

### Browser Management

```typescript
// Start browser
{
  "tool": "browser.start",
  "args": {
    "browserlessUrl": "ws://localhost:3000"
  }
}

// Stop browser
{
  "tool": "browser.stop",
  "args": {}
}

// Check status
{
  "tool": "browser.status",
  "args": {}
}
```

## Browser Lifecycle

**Important**: Always manage browser connections properly:

1. **Start browser** before operations:

   ```
   browser.start()
   ```

2. **Stop browser** when done:

   ```
   browser.stop()
   ```

3. The plugin auto-disconnects on session completion, but you should always manually stop the browser when finalizing your response.

## API Reference

### browse

Navigate to and browse web pages.

| Argument        | Type    | Required | Default | Description                |
| --------------- | ------- | -------- | ------- | -------------------------- |
| url             | string  | Yes      | -       | URL to navigate to         |
| waitForSelector | string  | No       | -       | CSS selector to wait for   |
| scrollTo        | string  | No       | -       | CSS selector to scroll to  |
| executeScript   | string  | No       | -       | JavaScript code to execute |
| extractContent  | boolean | No       | true    | Extract page content       |
| browserlessUrl  | string  | No       | -       | Browserless WebSocket URL  |

### search

Search using DuckDuckGo.

| Argument       | Type   | Required | Default | Description               |
| -------------- | ------ | -------- | ------- | ------------------------- |
| query          | string | Yes      | -       | Search query              |
| browserlessUrl | string | No       | -       | Browserless WebSocket URL |

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
| browserlessUrl | string  | No       | -       | Browserless WebSocket URL     |

### pdf

Generate PDF from HTML or URL.

| Argument        | Type    | Required | Default | Description               |
| --------------- | ------- | -------- | ------- | ------------------------- |
| html            | string  | No\*     | -       | HTML content              |
| url             | string  | No\*     | -       | URL to convert            |
| path            | string  | No       | -       | Output file path          |
| format          | enum    | No       | A4      | Paper format              |
| printBackground | boolean | No       | true    | Print backgrounds         |
| landscape       | boolean | No       | false   | Landscape mode            |
| marginTop       | string  | No       | 0cm     | Top margin                |
| marginBottom    | string  | No       | 0cm     | Bottom margin             |
| marginLeft      | string  | No       | 0cm     | Left margin               |
| marginRight     | string  | No       | 0cm     | Right margin              |
| browserlessUrl  | string  | No       | -       | Browserless WebSocket URL |

\*Either `html` or `url` is required.

### browser.start

Start browser connection.

| Argument       | Type   | Required | Default | Description               |
| -------------- | ------ | -------- | ------- | ------------------------- |
| browserlessUrl | string | No       | -       | Browserless WebSocket URL |

### browser.stop

Stop browser connection.

| Argument | Type    | Required | Default | Description      |
| -------- | ------- | -------- | ------- | ---------------- |
| force    | boolean | No       | false   | Force disconnect |

### browser.status

Check connection status.

No arguments required.

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

**Error**: "Browser not connected"

- Call `browser.start()` before operations
- Check connection status with `browser.status()`
- Restart browser if connection is lost

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

## License

MIT © [Ruby Hartono](https://github.com/rh-id)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please use the [GitHub Issues](https://github.com/rh-id/oc-browserless/issues) page.
