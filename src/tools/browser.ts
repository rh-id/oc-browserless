import { tool } from '@opencode-ai/plugin';
import { getBrowserManager, resetBrowserManager } from '../browser/manager.js';

export const start = tool({
  description: 'Start a browserless connection',
  args: {
    browserlessUrl: tool.schema
      .string()
      .optional()
      .describe('Browserless WebSocket URL (optional, uses env var by default)'),
  },
  async execute(args) {
    const browserManager = getBrowserManager();

    try {
      if (browserManager.isConnected()) {
        return JSON.stringify({
          success: true,
          message: 'Browser is already connected',
        });
      }

      const wsUrl = args.browserlessUrl || process.env.BROWSERLESS_URL || '';

      await browserManager.connect(wsUrl);

      return JSON.stringify({
        success: true,
        message: 'Browser connected successfully',
        wsUrl,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: (error as Error).message,
      });
    }
  },
});

export const stop = tool({
  description: 'Stop and disconnect the browserless connection',
  args: {
    force: tool.schema
      .boolean()
      .default(false)
      .describe('Force disconnect even if there are errors'),
  },
  async execute(args) {
    const browserManager = getBrowserManager();

    try {
      if (!browserManager.isConnected()) {
        return JSON.stringify({
          success: true,
          message: 'Browser is not connected',
        });
      }

      await browserManager.disconnect();

      if (args.force) {
        resetBrowserManager();
      }

      return JSON.stringify({
        success: true,
        message: 'Browser disconnected successfully',
      });
    } catch (error) {
      if (args.force) {
        resetBrowserManager();
        return JSON.stringify({
          success: true,
          message: 'Browser force disconnected',
          warning: (error as Error).message,
        });
      }

      return JSON.stringify({
        success: false,
        error: (error as Error).message,
      });
    }
  },
});

export const status = tool({
  description: 'Check the browser connection status',
  args: {},
  async execute() {
    const browserManager = getBrowserManager();

    try {
      const connected = browserManager.isConnected();

      return JSON.stringify({
        success: true,
        connected,
        message: connected ? 'Browser is connected' : 'Browser is not connected',
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: (error as Error).message,
      });
    }
  },
});
