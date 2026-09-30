export const BROWSERLESS_GUIDELINES = `
# Browserless Plugin Guidelines

## Browser Lifecycle Management
- All browser operations automatically manage their own connections
- No manual start/stop required - tools handle this internally
- Each tool execution creates an isolated browser instance
- Browser sessions are NOT persistent across tool calls

## Available Tools
- \`web_browse\` - Navigate to and browse web pages
- \`web_search\` - Search using SearXNG (if configured) or DuckDuckGo (returns JSON)
- \`web_screenshot\` - Capture screenshots in PNG/JPEG/WebP formats
- \`web_pdf\` - Generate PDF from HTML or URLs

## Return Structures
All tools return JSON with the following structures:

### web_browse
\`\`\`json
{
  "success": boolean,      // true if page loaded successfully
  "url": string | undefined,        // actual URL after redirects
  "title": string | undefined,      // page title
  "content": string | undefined,     // Markdown content of the page (boilerplate stripped)
  "certificate": {
    "issuer": string,               // certificate issuer
    "protocol": string,             // SSL/TLS protocol (e.g., TLS 1.2)
    "subjectName": string,          // certificate subject
    "subjectAlternativeNames": string[] | undefined,  // alternative domain names
    "validFrom": number,            // validity start timestamp
    "validTo": number               // validity end timestamp
  } | null | undefined,             // null for HTTP or when unavailable
  "error": string | undefined       // error message if failed
}
\`\`\`

### web_search
When \`SEARXNG_URL\` is set, returns structured JSON results directly from SearXNG API:
\`\`\`json
{
  "success": true,
  "query": string,
  "results": [
    {
      "url": string,
      "title": string,
      "content": string,
      "engine": string,
      "score": number,
      "category": string
    }
  ],
  "suggestions": string[],
  "number_of_results": number,
  "engine": "searxng",
  "error": string
}
\`\`\`
When SearXNG is not configured, falls back to DuckDuckGo and returns Markdown of the results page (boilerplate stripped):
\`\`\`json
{
  "success": true,
  "query": string,
  "content": string,
  "engine": "duckduckgo",
  "error": string
}
\`\`\`

### web_screenshot
\`\`\`json
{
  "success": boolean,      // true if screenshot captured
  "path": string | undefined,       // file path if saved to disk
  "base64": string | undefined,     // base64-encoded image if not saved
  "format": string | undefined,     // image format (png/jpeg/webp)
  "error": string | undefined       // error message if failed
}
\`\`\`
Either \`path\` or \`base64\` is returned depending on whether output file path is provided.

### web_pdf
\`\`\`json
{
  "success": boolean,      // true if PDF generated
  "path": string | undefined,       // file path if saved to disk
  "base64": string | undefined,     // base64-encoded PDF if not saved
  "format": string | undefined,     // paper format (A4, Letter, etc.)
  "error": string | undefined       // error message if failed
}
\`\`\`
Either \`path\` or \`base64\` is returned depending on whether output file path is provided.

## Environment Configuration
Set \`BROWSERLESS_URL\` env variable to your browserless instance:
- Local: \`ws://localhost:3000\`
- Remote: \`ws://your-browserless.com\`
- Remote with API key: Set \`BROWSERLESS_API_KEY\` (appended as a \`token\` query param; a token already embedded in \`BROWSERLESS_URL\` takes precedence)

### SearXNG (Optional - takes priority over DuckDuckGo)
- \`SEARXNG_URL\` - URL to your SearXNG instance (e.g., \`http://localhost:8888\`)
- \`SEARXNG_BASIC_USER\` - Basic auth username (leave empty if no auth)
- \`SEARXNG_BASIC_PASSWORD\` - Basic auth password
- When configured, \`web_search\` uses SearXNG JSON API directly (no browser needed)

## Important Notes
- Browserless supports multiple concurrent connections automatically
- Each tool operates in isolation with no shared state
- Connection errors and disconnection errors are both reported
- No connection reuse - each operation creates fresh browser instance
`;
