import type { Browser, Page, BrowserContext } from 'puppeteer-core';

export interface BrowserlessOptions {
  wsUrl?: string;
  apiKey?: string;
  timeout?: number;
}

export interface BrowserConfig {
  url: string;
  options: {
    headless?: boolean;
    args?: string[];
  };
}

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private connectionAttempts = 0;
  private readonly maxRetryAttempts = 3;
  private readonly defaultTimeout = 30000;

  async connect(wsUrl: string, options: BrowserlessOptions = {}): Promise<void> {
    if (this.browser) {
      return;
    }

    const { timeout = this.defaultTimeout } = options;
    const puppeteer = await import('puppeteer-core');

    try {
      this.browser = await puppeteer.connect({
        browserWSEndpoint: wsUrl,
      });

      this.context = await this.browser.createBrowserContext();
      this.page = await this.context.newPage();

      await this.page.setDefaultTimeout(timeout);

      this.connectionAttempts = 0;
    } catch (error) {
      this.connectionAttempts++;

      if (this.connectionAttempts < this.maxRetryAttempts) {
        await this.sleep(1000 * this.connectionAttempts);
        return this.connect(wsUrl, options);
      }

      throw new Error(`Failed to connect to browserless: ${(error as Error).message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.page) {
      await this.page.close().catch(() => {});
      this.page = null;
    }

    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }

    if (this.browser) {
      await this.browser.disconnect().catch(() => {});
      this.browser = null;
    }

    this.connectionAttempts = 0;
  }

  isConnected(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }

  async getPage(): Promise<Page> {
    if (!this.page) {
      throw new Error('Browser not connected. Call connect() first.');
    }

    if (!this.browser?.isConnected()) {
      throw new Error('Browser connection lost');
    }

    return this.page;
  }

  async restart(): Promise<void> {
    const wsUrl = this.getBrowserWSEndpoint();
    await this.disconnect();
    await this.connect(wsUrl);
  }

  private getBrowserWSEndpoint(): string {
    return this.browser?.wsEndpoint() || '';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

let browserManager: BrowserManager | null = null;

export function getBrowserManager(): BrowserManager {
  if (!browserManager) {
    browserManager = new BrowserManager();
  }
  return browserManager;
}

export function resetBrowserManager(): void {
  browserManager = null;
}
