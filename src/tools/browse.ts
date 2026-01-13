import { tool } from '@opencode-ai/plugin';
import { getBrowserManager } from '../../src/browser/manager.js';
import { isValidUrl } from '../utils/common.js';

export default tool({
  description: 'Navigate to and browse web pages using browserless',
  args: {
    url: tool.schema
      .string()
      .describe('The URL to navigate to')
      .refine(isValidUrl, 'Invalid URL format'),
    waitForSelector: tool.schema
      .string()
      .optional()
      .describe('CSS selector to wait for before returning'),
    scrollTo: tool.schema.string().optional().describe('CSS selector to scroll to'),
    executeScript: tool.schema
      .string()
      .optional()
      .describe('JavaScript code to execute in the page context'),
    extractContent: tool.schema
      .boolean()
      .default(true)
      .describe('Whether to extract and return page content'),
    browserlessUrl: tool.schema
      .string()
      .optional()
      .describe('Browserless WebSocket URL (optional, uses env var by default)'),
  },
  async execute(args) {
    const browserManager = getBrowserManager();

    try {
      const wsUrl = args.browserlessUrl || process.env.BROWSERLESS_URL || '';

      if (!browserManager.isConnected()) {
        await browserManager.connect(wsUrl);
      }

      const page = await browserManager.getPage();

      await page.goto(args.url, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      if (args.waitForSelector) {
        await page.waitForSelector(args.waitForSelector, {
          timeout: 10000,
        });
      }

      if (args.scrollTo) {
        await page.$eval(args.scrollTo, element => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      let scriptResult: any = undefined;
      if (args.executeScript) {
        scriptResult = await page.evaluate(args.executeScript);
      }

      let content: string | null = null;
      if (args.extractContent) {
        content = await page.content();
      }

      const title = await page.title();
      const url = page.url();

      return JSON.stringify({
        success: true,
        url,
        title,
        content: content ?? null,
        scriptResult,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: (error as Error).message,
      });
    }
  },
});
