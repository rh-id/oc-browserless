import { tool } from '@opencode-ai/plugin';
import { createBrowserManager } from '../browser/manager.js';
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
  },
  async execute(args) {
    const browserManager = createBrowserManager();
    const wsUrl = process.env.BROWSERLESS_URL || '';

    let disconnectError: Error | null = null;
    let mainError: Error | null = null;
    let result: any;

    try {
      await browserManager.connect(wsUrl);
      const page = await browserManager.getPage();
      const timeout = parseInt(process.env.BROWSERLESS_TIMEOUT || '30000', 10);
      await page.goto(args.url, {
        waitUntil: 'networkidle2',
        timeout,
      });

      if (args.waitForSelector) {
        await page.waitForSelector(args.waitForSelector, {
          timeout,
        });
      }

      if (args.scrollTo) {
        await page.$eval(args.scrollTo, (element: any) => {
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

      result = {
        success: true,
        url,
        title,
        content: content ?? null,
        scriptResult,
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
