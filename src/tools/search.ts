import { tool } from '@opencode-ai/plugin';
import { createBrowserManager } from '../browser/manager.js';

function buildDuckDuckGoUrl(query: string): string {
  const encodedQuery = encodeURIComponent(query);
  return `https://html.duckduckgo.com/html/?q=${encodedQuery}`;
}

export default tool({
  description: 'Search web using DuckDuckGo and return raw HTML content',
  args: {
    query: tool.schema.string().describe('The search query'),
  },
  async execute(args) {
    const browserManager = createBrowserManager();
    const wsUrl = process.env.BROWSERLESS_URL || '';
    const timeout = parseInt(process.env.BROWSERLESS_TIMEOUT || '30000', 10);

    let disconnectError: Error | null = null;
    let mainError: Error | null = null;
    let result: any;

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
