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
      const response = await page.goto(args.url, {
        waitUntil: 'networkidle2',
        timeout,
      });

      let certificate: any = null;
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
      const url = page.url();
      const content = await page.content();

      result = {
        success: true,
        url,
        title,
        content,
        certificate,
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
