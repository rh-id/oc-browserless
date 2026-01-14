import { tool } from '@opencode-ai/plugin';
import { createBrowserManager } from '../browser/manager.js';

export default tool({
  description: 'Generate PDF from HTML content or URL using browserless',
  args: {
    html: tool.schema.string().optional().describe('HTML content to convert to PDF'),
    url: tool.schema.string().optional().describe('URL to convert to PDF'),
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
    const wsUrl = process.env.BROWSERLESS_URL || '';
    const timeout = parseInt(process.env.BROWSERLESS_TIMEOUT || '30000', 10);

    let disconnectError: Error | null = null;
    let mainError: Error | null = null;
    let result: any;

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
        await page.pdf(pdfOptionsWithFile as any);

        pdfResult = {
          path: args.path,
          format: args.format,
          pages: 1,
        };
      } else {
        const buffer = await page.pdf(pdfOptions as any);
        const base64 = (buffer as Buffer).toString('base64');

        pdfResult = {
          base64,
          format: args.format,
          pages: 1,
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
        disconnected: false,
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
        disconnected: true,
      });
    }

    return JSON.stringify(result);
  },
});
