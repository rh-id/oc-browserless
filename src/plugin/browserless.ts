import { tool } from '@opencode-ai/plugin';
import type { Browser, Page, BrowserContext } from 'puppeteer-core';
import sanitizeHtml from 'sanitize-html';

function isValidUrl(url: string): boolean {
  try {
    const urlObject = new URL(url);
    return urlObject.protocol === 'http:' || urlObject.protocol === 'https:';
  } catch {
    return false;
  }
}

async function stripHtmlContent(page: Page): Promise<string> {
  const html = await page.content();
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[1] : html;

  const cleanHtml = sanitizeHtml(bodyHtml, {
    allowedTags: [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'span',
      'div',
      'ul',
      'ol',
      'li',
      'article',
      'section',
      'main',
      'aside',
      'header',
      'footer',
      'nav',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'sub',
      'sup',
      'br',
      'hr',
      'blockquote',
      'pre',
      'code',
      'table',
      'thead',
      'tbody',
      'tfoot',
      'tr',
      'th',
      'td',
      'figure',
      'figcaption',
      'a',
      'img',
      'video',
      'audio',
    ],
    allowedAttributes: {
      a: ['href'],
      img: ['src', 'alt'],
      video: ['src'],
      audio: ['src'],
    },
    disallowedTagsMode: 'discard',
    allowVulnerableTags: false,
    parseStyleAttributes: false,
    enforceHtmlBoundary: false,
  });

  return cleanHtml.trim();
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
  html?: string;
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
    this.defaultTimeout = parseInt(process.env.BROWSERLESS_TIMEOUT || '30000', 10);
  }

  async connect(wsUrl: string, options: BrowserlessOptions = {}): Promise<void> {
    if (this.browser && this.browser.connected) {
      return;
    }

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

  isConnected(): boolean {
    return this.browser !== null && this.browser.connected;
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
      await browserManager.connect(wsUrl);
      const page = await browserManager.getPage();
      const timeout = parseInt(process.env.BROWSERLESS_TIMEOUT || '30000', 10);
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
      const content = await stripHtmlContent(page);

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
        error: mainError.message,
      };
    } finally {
      try {
        await browserManager.disconnect();
      } catch (error) {
        disconnectError = error as Error;
      }
    }

    if (!mainError && disconnectError) {
      return JSON.stringify({
        success: false,
        error: disconnectError.message,
      });
    }

    return JSON.stringify(result);
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

  const response = await fetch(searchUrl, { headers });
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
          error: (error as Error).message,
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
    const timeout = parseInt(process.env.BROWSERLESS_TIMEOUT || '30000', 10);

    let disconnectError: Error | null = null;
    let mainError: Error | null = null;
    let result: SearchResult;

    try {
      const url = buildDuckDuckGoUrl(args.query);

      await browserManager.connect(wsUrl);
      const page = await browserManager.getPage();

      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout,
      });

      const html = await stripHtmlContent(page);

      result = {
        success: true,
        query: args.query,
        html,
        engine: 'duckduckgo',
      };
    } catch (error) {
      mainError = error as Error;
      result = {
        success: false,
        error: mainError.message,
      };
    } finally {
      try {
        await browserManager.disconnect();
      } catch (error) {
        disconnectError = error as Error;
      }
    }

    if (!mainError && disconnectError) {
      return JSON.stringify({
        success: false,
        error: disconnectError.message,
      });
    }

    return JSON.stringify(result);
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

    if (!args.url) {
      return JSON.stringify({
        success: false,
        error: 'URL is required',
      });
    }
    const timeout = parseInt(process.env.BROWSERLESS_TIMEOUT || '30000', 10);

    let disconnectError: Error | null = null;
    let mainError: Error | null = null;
    let result: ScreenshotResult;

    try {
      await browserManager.connect(wsUrl);
      const page = await browserManager.getPage();

      if (args.viewportWidth || args.viewportHeight) {
        await page.setViewport({
          width: args.viewportWidth || 1280,
          height: args.viewportHeight || 720,
        });
      }

      if (args.url) {
        await page.goto(args.url, {
          waitUntil: 'networkidle2',
          timeout,
        });
      }

      const screenshotOptions = {
        type: args.format,
        fullPage: args.fullPage,
        path: args.path || undefined,
        quality: args.format === 'jpeg' || args.format === 'webp' ? args.quality || 80 : undefined,
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
        error: mainError.message,
      };
    } finally {
      try {
        await browserManager.disconnect();
      } catch (error) {
        disconnectError = error as Error;
      }
    }

    if (!mainError && disconnectError) {
      return JSON.stringify({
        success: false,
        error: disconnectError.message,
      });
    }

    return JSON.stringify(result);
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
    const timeout = parseInt(process.env.BROWSERLESS_TIMEOUT || '30000', 10);

    let disconnectError: Error | null = null;
    let mainError: Error | null = null;
    let result: PdfResult;

    try {
      await browserManager.connect(wsUrl);
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
        error: mainError.message,
      };
    } finally {
      try {
        await browserManager.disconnect();
      } catch (error) {
        disconnectError = error as Error;
      }
    }

    if (!mainError && disconnectError) {
      return JSON.stringify({
        success: false,
        error: disconnectError.message,
      });
    }

    return JSON.stringify(result);
  },
});

export const BrowserlessPlugin = async () => {
  return {
    tool: {
      browse: browseTool,
      search: searchTool,
      screenshot: screenshotTool,
      pdf: pdfTool,
    },
    'experimental.chat.system.transform': async (
      _input: { system: string[] },
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
- \`browse\` - Navigate to and browse web pages
- \`search\` - Search using SearXNG (if configured) or DuckDuckGo (returns JSON)
- \`screenshot\` - Capture screenshots in PNG/JPEG/WebP formats
- \`pdf\` - Generate PDF from HTML or URLs

## Return Structures
All tools return JSON with the following structures:

### browse
\`\`\`json
{
  "success": boolean,      // true if page loaded successfully
  "url": string | undefined,        // actual URL after redirects
  "title": string | undefined,      // page title
  "content": string | undefined,     // HTML content of the page
  "certificate": {
    "issuer": string,               // certificate issuer
    "protocol": string,             // SSL/TLS protocol (e.g., TLS 1.2)
    "subjectName": string,          // certificate subject
    "subjectAlternativeNames": string[] | undefined,  // alternative domain names
    "validFrom": number,            // validity start timestamp
    "validTo": number               // validity end timestamp
  } | null | undefined,             // null for HTTP, undefined if unavailable
  "error": string | undefined       // error message if failed
}
\`\`\`

### search
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
When SearXNG is not configured, falls back to DuckDuckGo with HTML results:
\`\`\`json
{
  "success": true,
  "query": string,
  "html": string,
  "engine": "duckduckgo",
  "error": string
}
\`\`\`

### screenshot
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

### pdf
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
- Remote with API key: Set \`BROWSERLESS_API_KEY\`

### SearXNG (Optional - takes priority over DuckDuckGo)
- \`SEARXNG_URL\` - URL to your SearXNG instance (e.g., \`http://localhost:8888\`)
- \`SEARXNG_BASIC_USER\` - Basic auth username (leave empty if no auth)
- \`SEARXNG_BASIC_PASSWORD\` - Basic auth password
- When configured, search uses SearXNG JSON API directly (no browser needed)

## Important Notes
- Browserless supports multiple concurrent connections automatically
- Each tool operates in isolation with no shared state
- Connection errors and disconnection errors are both reported
- No connection reuse - each operation creates fresh browser instance
`);
    },
  };
};
