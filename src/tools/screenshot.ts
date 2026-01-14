import { tool } from '@opencode-ai/plugin';
import { createBrowserManager } from '../browser/manager.js';

export default tool({
  description: 'Take screenshots of web pages using browserless',
  args: {
    url: tool.schema
      .string()
      .optional()
      .describe('URL to screenshot (if not provided, uses current page)'),
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
    const wsUrl = process.env.BROWSERLESS_URL || '';
    const timeout = parseInt(process.env.BROWSERLESS_TIMEOUT || '30000', 10);

    let disconnectError: Error | null = null;
    let mainError: Error | null = null;
    let result: any;

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

      let screenshotResult: {
        path?: string;
        base64?: string;
        format: string;
        size: {
          width: number;
          height: number;
        };
      };

      if (args.path) {
        screenshotResult = {
          path: args.path,
          format: args.format,
          size: {
            width: 0,
            height: 0,
          },
        };
      } else {
        const screenshotOptions = {
          type: args.format,
          fullPage: args.fullPage,
        };

        if (args.format === 'jpeg' || args.format === 'webp') {
          (screenshotOptions as any).quality = args.quality || 80;
        }

        const buffer = await page.screenshot(screenshotOptions);
        const base64 = (buffer as Buffer).toString('base64');

        const viewport = page.viewport();

        screenshotResult = {
          base64,
          format: args.format,
          size: {
            width: viewport?.width || 0,
            height: viewport?.height || 0,
          },
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
