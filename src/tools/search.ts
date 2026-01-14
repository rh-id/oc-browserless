import { tool } from '@opencode-ai/plugin';
import { getBrowserManager } from '../browser/manager.js';

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
    const browserManager = getBrowserManager();

    try {
      const url = buildDuckDuckGoUrl(args.query);
      const wsUrl = process.env.BROWSERLESS_URL || '';

      if (!browserManager.isConnected()) {
        await browserManager.connect(wsUrl);
      }

      const page = await browserManager.getPage();

      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      const html = await page.content();

      return JSON.stringify({
        success: true,
        query: args.query,
        html,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: (error as Error).message,
      });
    }
  },
});
