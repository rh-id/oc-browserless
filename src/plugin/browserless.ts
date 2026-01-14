import { tool } from '@opencode-ai/plugin';
import type { Browser, Page, BrowserContext } from 'puppeteer-core';

function isValidUrl(url: string): boolean {
  try {
    const urlObject = new URL(url);
    return urlObject.protocol === 'http:' || urlObject.protocol === 'https:';
  } catch {
    return false;
  }
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

interface SearchResult {
  success: boolean;
  query?: string;
  html?: string;
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
  pages?: number;
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
      const content = await page.content();

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

const searchTool = tool({
  description: 'Search web using DuckDuckGo and return raw HTML content',
  args: {
    query: tool.schema.string().describe('The search query'),
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

      const html = await page.content();

      result = {
        success: true,
        query: args.query,
        html,
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
        pages: number;
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
          pages: 0,
        };
      } else {
        const buffer = await page.pdf(pdfOptions);
        const base64 = Buffer.from(buffer).toString('base64');

        pdfResult = {
          base64,
          format: args.format,
          pages: 0,
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
