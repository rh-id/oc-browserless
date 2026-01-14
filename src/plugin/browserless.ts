export const BrowserlessPlugin = async () => {
  return {
    'experimental.chat.system.transform': async (input: any, output: any) => {
      output.system.push(`
# Browserless Plugin Guidelines

## Browser Lifecycle Management
- All browser operations automatically manage their own connections
- No manual start/stop required - tools handle this internally
- Each tool execution creates an isolated browser instance
- Browser sessions are NOT persistent across tool calls

## Available Tools
- \`browse\` - Navigate to and browse web pages
- \`search\` - Search using DuckDuckGo (returns JSON with HTML)
- \`screenshot\` - Capture screenshots in PNG/JPEG/WebP formats
- \`pdf\` - Generate PDF from HTML or URLs

## Environment Configuration
Set \`BROWSERLESS_URL\` env variable to your browserless instance:
- Local: \`ws://localhost:3000\`
- Remote: \`ws://your-browserless.com\`
- Remote with API key: Set \`BROWSERLESS_API_KEY\`

## Important Notes
- Browserless supports multiple concurrent connections automatically
- Each tool operates in isolation with no shared state
- Connection errors and disconnection errors are both reported
- No connection reuse - each operation creates fresh browser instance
`);
    },
  };
};
