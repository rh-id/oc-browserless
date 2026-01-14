import type { Browser, Page, BrowserContext } from 'puppeteer-core';

export interface BrowserlessOptions {
  timeout?: number;
}

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private readonly defaultTimeout: number;

  constructor() {
    this.defaultTimeout = parseInt(process.env.BROWSERLESS_TIMEOUT || '30000', 10);
  }

  async connect(wsUrl: string, options: BrowserlessOptions = {}): Promise<void> {
    if (this.browser) {
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

    if (this.page) {
      try {
        await this.page.close();
      } catch (error) {
        errors.push(error as Error);
      }
      this.page = null;
    }

    if (this.context) {
      try {
        await this.context.close();
      } catch (error) {
        errors.push(error as Error);
      }
      this.context = null;
    }

    if (this.browser) {
      try {
        await this.browser.disconnect();
      } catch (error) {
        errors.push(error as Error);
      }
      this.browser = null;
    }

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

export function createBrowserManager(): BrowserManager {
  return new BrowserManager();
}
