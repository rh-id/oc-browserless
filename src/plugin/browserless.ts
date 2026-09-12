import { tool } from '@opencode-ai/plugin';
import type { Model } from '@opencode-ai/sdk';
import type { Browser, Page, BrowserContext } from 'puppeteer-core';
import { NodeHtmlMarkdown } from 'node-html-markdown';

function isValidUrl(url: string): boolean {
  try {
    const urlObject = new URL(url);
    return urlObject.protocol === 'http:' || urlObject.protocol === 'https:';
  } catch {
    return false;
  }
}

function buildWsUrl(wsUrl: string): string {
  const apiKey = process.env.BROWSERLESS_API_KEY;
  if (!apiKey) return wsUrl;
  // explicit token in the URL always wins
  if (/[?&]token=/.test(wsUrl)) return wsUrl;
  return wsUrl + (wsUrl.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(apiKey);
}

function sanitizeErrorMessage(message: string): string {
  return message.replace(/([a-z][a-z0-9+.-]*:\/\/[^\s?]*)\?[^\s)]*/gi, '$1?[redacted]');
}

function parseTimeout(): number {
  const parsed = parseInt(process.env.BROWSERLESS_TIMEOUT || '30000', 10);
  return Number.isNaN(parsed) ? 30000 : parsed;
}

function finalizeResult(
  result: { success: boolean; error?: string },
  mainError: Error | null,
  disconnectError: Error | null,
): string {
  if (mainError && disconnectError) {
    result.error = `${sanitizeErrorMessage(mainError.message)} (disconnect also failed: ${sanitizeErrorMessage(disconnectError.message)})`;
  }
  if (!mainError && disconnectError) {
    return JSON.stringify({
      success: false,
      error: sanitizeErrorMessage(disconnectError.message),
    });
  }
  return JSON.stringify(result);
}

// Runs inside the page via page.evaluate(): puppeteer serializes the function source
// into the browser, so it must not close over any module state (hence the inline
// selector list). The optional docArg parameter exists only so tests can drive the
// same logic with a synthetic document; inside a real page it reads globalThis.document.
export function cleanupPageAndExtract(docArg?: Document): string {
  const doc = docArg ?? (globalThis as { document?: Document }).document;
  if (!doc?.body) return '';
  const selectors = [
    // media / embedded content
    'script',
    'style',
    'noscript',
    'template',
    'iframe',
    'frame',
    'frameset',
    'object',
    'embed',
    'svg',
    'canvas',
    'video',
    'audio',
    'source',
    'track',
    'map',
    // interactive elements
    'form',
    'input',
    'select',
    'textarea',
    'button',
    'label',
    'dialog',
    // layout boilerplate
    'nav',
    'header',
    'footer',
    'aside',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '[role="dialog"]',
    '[role="search"]',
    // invisible by attribute
    '[hidden]',
    '[aria-hidden="true"]',
  ].join(',');
  doc.body.querySelectorAll(selectors).forEach(el => el.remove());
  const view = doc.defaultView;
  if (view && typeof view.getComputedStyle === 'function') {
    for (const el of Array.from(doc.body.querySelectorAll('*'))) {
      try {
        const style = view.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') el.remove();
      } catch {
        /* ignore */
      }
    }
  }
  return doc.body.innerHTML;
}

export function collapseWhitespace(markdown: string): string {
  return markdown
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseMaxContent(): number {
  const parsed = parseInt(process.env.BROWSERLESS_MAX_CONTENT || '100000', 10);
  return Number.isNaN(parsed) ? 100000 : parsed;
}

export function truncateContent(content: string): string {
  const max = parseMaxContent();
  if (max <= 0 || content.length <= max) return content;
  return content.slice(0, max) + `\n\n[... content truncated at ${max} characters ...]`;
}

const markdownConverter = new NodeHtmlMarkdown();

export async function extractPageContent(page: Page): Promise<string> {
  let bodyHtml = '';
  try {
    bodyHtml = await page.evaluate(cleanupPageAndExtract);
  } catch {
    try {
      bodyHtml = await page.$eval('body', el => el.innerHTML);
    } catch {
      bodyHtml = '';
    }
  }
  if (!bodyHtml.trim()) return '';
  return truncateContent(collapseWhitespace(markdownConverter.translate(bodyHtml)));
}

interface BrowserlessOptions {
  timeout?: number;
}

interface SecurityCertificate {
  issuer: string;
  protocol: string;
  subjectName: string;
  subjectAlternativeNames?: string[];
  validFrom: number;
  validTo: number;
}

interface BrowseResult {
  success: boolean;
  url?: string;
  title?: string;
  content?: string;
  certificate?: SecurityCertificate | null;
  error?: string;
}

interface SearXNGResultItem {
  url: string;
  title: string;
  content: string;
  engine: string;
  score: number;
  category: string;
  parsed_url?: unknown[];
}

interface SearchResult {
  success: boolean;
  query?: string;
  content?: string;
  results?: SearXNGResultItem[];
  engine?: 'searxng' | 'duckduckgo';
  suggestions?: string[];
  number_of_results?: number;
  error?: string;
}

interface ScreenshotResult {
  success: boolean;
  path?: string;
  base64?: string;
  format?: string;
  error?: string;
}

interface PdfResult {
  success: boolean;
  path?: string;
  base64?: string;
  format?: string;
  error?: string;
}

class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private readonly defaultTimeout: number;

  constructor() {
    this.defaultTimeout = parseTimeout();
  }

  async connect(wsUrl: string, options: BrowserlessOptions = {}): Promise<void> {
    const { timeout = this.defaultTimeout } = options;
    const puppeteer = await import('puppeteer-core');

    this.browser = await puppeteer.connect({
      browserWSEndpoint: wsUrl,
    });

    this.context = await this.browser.createBrowserContext();
    this.page = await this.context.newPage();

    await this.page.setDefaultTimeout(timeout);
  }

  async disconnect(): Promise<void> {
    const errors: Error[] = [];
    const hasPage = this.page !== null;
    const hasContext = this.context !== null;
    const hasBrowser = this.browser !== null;

    if (hasPage) {
      try {
        await this.page!.close();
      } catch (error) {
        errors.push(error as Error);
      }
    }

    if (hasContext) {
      try {
        await this.context!.close();
      } catch (error) {
        errors.push(error as Error);
      }
    }

    if (hasBrowser) {
      try {
        await this.browser!.disconnect();
      } catch (error) {
        errors.push(error as Error);
      }
    }

    this.page = null;
    this.context = null;
    this.browser = null;

    if (errors.length > 0) {
      throw new Error(`Failed to disconnect: ${errors.map(e => e.message).join(', ')}`);
    }
  }

  async getPage(): Promise<Page> {
    if (!this.page) {
      throw new Error('Browser not connected. Call connect() first.');
    }

    if (!this.browser?.connected) {
      throw new Error('Browser connection lost');
    }

    return this.page;
  }
}

function createBrowserManager(): BrowserManager {
  return new BrowserManager();
}

const browseTool = tool({
  description: 'Navigate to and browse web pages using browserless',
  args: {
    url: tool.schema
      .string()
      .describe('The URL to navigate to')
      .refine(isValidUrl, 'Invalid URL format'),
  },
  async execute(args) {
    const browserManager = createBrowserManager();
    const wsUrl = process.env.BROWSERLESS_URL;
    if (!wsUrl) {
      return JSON.stringify({
        success: false,
        error: 'BROWSERLESS_URL environment variable is not set',
      });
    }

    let disconnectError: Error | null = null;
    let mainError: Error | null = null;
    let result: BrowseResult;

    try {
      await browserManager.connect(buildWsUrl(wsUrl));
      const page = await browserManager.getPage();
      const timeout = parseTimeout();
      const response = await page.goto(args.url, {
        waitUntil: 'networkidle2',
        timeout,
      });

      let certificate: SecurityCertificate | null = null;
      if (response) {
        const securityDetails = await response.securityDetails();
        if (securityDetails) {
          certificate = {
            issuer: securityDetails.issuer(),
            protocol: securityDetails.protocol(),
            subjectName: securityDetails.subjectName(),
            subjectAlternativeNames: securityDetails.subjectAlternativeNames(),
            validFrom: securityDetails.validFrom(),
            validTo: securityDetails.validTo(),
          };
        }
      }

      const title = await page.title();
      const actualUrl = page.url();
      const content = await extractPageContent(page);

      result = {
        success: true,
        url: actualUrl,
        title,
        content,
        certificate,
      };
    } catch (error) {
      mainError = error as Error;
      result = {
        success: false,
        error: sanitizeErrorMessage(mainError.message),
      };
    } finally {
      try {
        await browserManager.disconnect();
      } catch (error) {
        disconnectError = error as Error;
      }
    }

    return finalizeResult(result, mainError, disconnectError);
  },
});

function buildDuckDuckGoUrl(query: string): string {
  const encodedQuery = encodeURIComponent(query);
  return `https://html.duckduckgo.com/html/?q=${encodedQuery}`;
}

async function searchWithSearXNG(query: string): Promise<SearchResult> {
  const searxngUrl = process.env.SEARXNG_URL;
  if (!searxngUrl) {
    throw new Error('SEARXNG_URL is not set');
  }

  const baseUrl = searxngUrl.replace(/\/+$/, '');
  const encodedQuery = encodeURIComponent(query);
  const searchUrl = `${baseUrl}/search?q=${encodedQuery}&format=json`;

  const headers: Record<string, string> = {};
  const user = process.env.SEARXNG_BASIC_USER || '';
  if (user) {
    const password = process.env.SEARXNG_BASIC_PASSWORD || '';
    const credentials = Buffer.from(`${user}:${password}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  }

  const response = await fetch(searchUrl, {
    headers,
    signal: AbortSignal.timeout(parseTimeout()),
  });
  if (!response.ok) {
    throw new Error(`SearXNG request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    query?: string;
    results?: SearXNGResultItem[];
    suggestions?: string[];
    number_of_results?: number;
  };

  return {
    success: true,
    query: data.query || query,
    results: data.results || [],
    suggestions: data.suggestions || [],
    number_of_results: data.number_of_results,
    engine: 'searxng',
  };
}

const searchTool = tool({
  description: 'Search web using SearXNG (if configured) or DuckDuckGo and return results',
  args: {
    query: tool.schema.string().describe('The search query'),
  },
  async execute(args) {
    if (process.env.SEARXNG_URL) {
      try {
        const result = await searchWithSearXNG(args.query);
        return JSON.stringify(result);
      } catch (error) {
        return JSON.stringify({
          success: false,
          query: args.query,
          engine: 'searxng',
          error: sanitizeErrorMessage((error as Error).message),
        });
      }
    }

    const browserManager = createBrowserManager();
    const wsUrl = process.env.BROWSERLESS_URL;
    if (!wsUrl) {
      return JSON.stringify({
        success: false,
        error: 'BROWSERLESS_URL environment variable is not set',
      });
    }
    const timeout = parseTimeout();

    let disconnectError: Error | null = null;
    let mainError: Error | null = null;
    let result: SearchResult;

    try {
      const url = buildDuckDuckGoUrl(args.query);

      await browserManager.connect(buildWsUrl(wsUrl));
      const page = await browserManager.getPage();

      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout,
      });

      const content = await extractPageContent(page);

      result = {
        success: true,
        query: args.query,
        content,
        engine: 'duckduckgo',
      };
    } catch (error) {
      mainError = error as Error;
      result = {
        success: false,
        error: sanitizeErrorMessage(mainError.message),
      };
    } finally {
      try {
        await browserManager.disconnect();
      } catch (error) {
        disconnectError = error as Error;
      }
    }

    return finalizeResult(result, mainError, disconnectError);
  },
});

const screenshotTool = tool({
  description: 'Take screenshots of web pages using browserless',
  args: {
    url: tool.schema
      .string()
      .describe('URL to screenshot')
      .refine(isValidUrl, 'Invalid URL format'),
    path: tool.schema
      .string()
      .optional()
      .describe('Output file path (if not provided, returns base64)'),
    format: tool.schema
      .enum(['png', 'jpeg', 'webp'])
      .default('png')
      .describe('Format: png, jpeg, webp'),
    fullPage: tool.schema
      .boolean()
      .default(false)
      .describe('Capture full page instead of viewport'),
    quality: tool.schema
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe('Quality for jpeg/webp (0-100)'),
    viewportWidth: tool.schema
      .number()
      .min(100)
      .max(5000)
      .optional()
      .describe('Viewport width in pixels'),
    viewportHeight: tool.schema
      .number()
      .min(100)
      .max(5000)
      .optional()
      .describe('Viewport height in pixels'),
  },
  async execute(args) {
    const browserManager = createBrowserManager();
    const wsUrl = process.env.BROWSERLESS_URL;
    if (!wsUrl) {
      return JSON.stringify({
        success: false,
        error: 'BROWSERLESS_URL environment variable is not set',
      });
    }

    const timeout = parseTimeout();

    let disconnectError: Error | null = null;
    let mainError: Error | null = null;
    let result: ScreenshotResult;

    try {
      await browserManager.connect(buildWsUrl(wsUrl));
      const page = await browserManager.getPage();

      if (args.viewportWidth || args.viewportHeight) {
        await page.setViewport({
          width: args.viewportWidth || 1280,
          height: args.viewportHeight || 720,
        });
      }

      await page.goto(args.url, {
        waitUntil: 'networkidle2',
        timeout,
      });

      const screenshotOptions = {
        type: args.format,
        fullPage: args.fullPage,
        path: args.path || undefined,
        quality:
          args.format === 'jpeg' || args.format === 'webp' ? (args.quality ?? 80) : undefined,
      } as const;

      const buffer = await page.screenshot(screenshotOptions);

      let screenshotResult: {
        path?: string;
        base64?: string;
        format: string;
      };

      if (args.path) {
        screenshotResult = {
          path: args.path,
          format: args.format,
        };
      } else {
        const base64 = Buffer.from(buffer).toString('base64');

        screenshotResult = {
          base64,
          format: args.format,
        };
      }

      result = {
        success: true,
        ...screenshotResult,
      };
    } catch (error) {
      mainError = error as Error;
      result = {
        success: false,
        error: sanitizeErrorMessage(mainError.message),
      };
    } finally {
      try {
        await browserManager.disconnect();
      } catch (error) {
        disconnectError = error as Error;
      }
    }

    return finalizeResult(result, mainError, disconnectError);
  },
});

const pdfTool = tool({
  description: 'Generate PDF from HTML content or URL using browserless',
  args: {
    html: tool.schema.string().optional().describe('HTML content to convert to PDF'),
    url: tool.schema
      .string()
      .optional()
      .refine(value => !value || isValidUrl(value), 'Invalid URL format')
      .describe('URL to convert to PDF'),
    path: tool.schema
      .string()
      .optional()
      .describe('Output file path (if not provided, returns base64)'),
    format: tool.schema
      .enum(['A4', 'Letter', 'Legal', 'Tabloid', 'Ledger', 'A0', 'A1', 'A2', 'A3', 'A5', 'A6'])
      .default('A4')
      .describe('Paper format'),
    printBackground: tool.schema.boolean().default(true).describe('Print background graphics'),
    landscape: tool.schema.boolean().default(false).describe('Landscape orientation'),
    marginTop: tool.schema.string().default('0cm').describe('Top margin (e.g., "1cm", "0.5in")'),
    marginBottom: tool.schema
      .string()
      .default('0cm')
      .describe('Bottom margin (e.g., "1cm", "0.5in")'),
    marginLeft: tool.schema.string().default('0cm').describe('Left margin (e.g., "1cm", "0.5in")'),
    marginRight: tool.schema
      .string()
      .default('0cm')
      .describe('Right margin (e.g., "1cm", "0.5in")'),
  },
  async execute(args) {
    if (!args.html && !args.url) {
      return JSON.stringify({
        success: false,
        error: 'Either html or url must be provided',
      });
    }

    if (args.html && args.url) {
      return JSON.stringify({
        success: false,
        error: 'Cannot provide both html and url. Choose one.',
      });
    }

    const browserManager = createBrowserManager();
    const wsUrl = process.env.BROWSERLESS_URL;
    if (!wsUrl) {
      return JSON.stringify({
        success: false,
        error: 'BROWSERLESS_URL environment variable is not set',
      });
    }
    const timeout = parseTimeout();

    let disconnectError: Error | null = null;
    let mainError: Error | null = null;
    let result: PdfResult;

    try {
      await browserManager.connect(buildWsUrl(wsUrl));
      const page = await browserManager.getPage();

      if (args.url) {
        await page.goto(args.url, {
          waitUntil: 'networkidle2',
          timeout,
        });
      } else {
        await page.setContent(args.html!, {
          waitUntil: 'networkidle2',
        });
      }

      const pdfOptions = {
        format: args.format,
        printBackground: args.printBackground,
        landscape: args.landscape,
        margin: {
          top: args.marginTop,
          bottom: args.marginBottom,
          left: args.marginLeft,
          right: args.marginRight,
        },
      };

      let pdfResult: {
        path?: string;
        base64?: string;
        format: string;
      };

      if (args.path) {
        const pdfOptionsWithFile = {
          ...pdfOptions,
          path: args.path,
        };
        await page.pdf(pdfOptionsWithFile);

        pdfResult = {
          path: args.path,
          format: args.format,
        };
      } else {
        const buffer = await page.pdf(pdfOptions);
        const base64 = Buffer.from(buffer).toString('base64');

        pdfResult = {
          base64,
          format: args.format,
        };
      }

      result = {
        success: true,
        ...pdfResult,
      };
    } catch (error) {
      mainError = error as Error;
      result = {
        success: false,
        error: sanitizeErrorMessage(mainError.message),
      };
    } finally {
      try {
        await browserManager.disconnect();
      } catch (error) {
        disconnectError = error as Error;
      }
    }

    return finalizeResult(result, mainError, disconnectError);
  },
});

export const BrowserlessPlugin = async () => {
  return {
    tool: {
      web_browse: browseTool,
      web_search: searchTool,
      web_screenshot: screenshotTool,
      web_pdf: pdfTool,
    },
    'experimental.chat.system.transform': async (
      _input: { sessionID?: string; model: Model },
      output: { system: string[] },
    ) => {
      output.system.push(`
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
`);
    },
  };
};
