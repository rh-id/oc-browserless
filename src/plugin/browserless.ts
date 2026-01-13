import { getBrowserManager } from '../browser/manager.js';

export const BrowserlessPlugin = async () => {
  return {
    event: async ({ event }: { event: any }) => {
      if (event.type === 'session.created') {
        return;
      }
      if (event.type === 'session.updated') {
        const browserManager = getBrowserManager();
        if (browserManager.isConnected()) {
          await browserManager.disconnect();
        }
      }
      if (event.type === 'session.error') {
        const browserManager = getBrowserManager();
        if (browserManager.isConnected()) {
          await browserManager.disconnect();
        }
      }
    },
    'experimental.chat.system.transform': async (input: any, output: any) => {
      output.system.push(`
# Browserless Plugin Guidelines

## Browser Lifecycle Management
1. Use \`browser.start()\` before any browser operations
2. Always call \`browser.stop()\` when finalizing response
3. Browser sessions are NOT persistent across opencode sessions
4. Browser instances are limited, manage connections carefully

## Available Tools
- \`browse\` - Navigate to and browse web pages
- \`search\` - Search using DuckDuckGo (returns JSON with HTML)
- \`screenshot\` - Capture screenshots in PNG/JPEG/WebP formats
- \`pdf\` - Generate PDF from HTML or URLs
- \`browser.start\` - Start browserless connection
- \`browser.stop\` - Stop and disconnect browser
- \`browser.status\` - Check browser connection status

## Environment Configuration
Set \`BROWSERLESS_URL\` env variable to your browserless instance:
- Local: \`ws://localhost:3000\`
- Remote: \`ws://your-browserless.com\`
- Remote with API key: Set \`BROWSERLESS_API_KEY\`

## Important Notes
- Always stop browser before session completes to avoid broken connections
- Screenshot and PDF tools auto-manage browser connections
- DuckDuckGo search can use fetch API (faster) or browser (for complex pages)
`);
    },
  };
};
