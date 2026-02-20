import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import puppeteer from 'puppeteer';

const BrowserInputSchema = z.object({
  url: z.string().describe('The URL to visit.'),
  selector: z.string().optional().describe('Optional CSS selector to extract text from. If omitted, returns full page text.'),
  waitForContent: z.boolean().optional().describe('Whether to wait for network idle to ensure dynamic content loads.'),
});

export const browsePage = new DynamicStructuredTool({
  name: 'browse_page',
  description: `Visit a webpage using a headless browser (Puppeteer) to extract content.
Use this for sites that require JavaScript to render (SPAs, React apps) or block simple fetch requests.
Returns the text content of the page or a specific element.`,
  schema: BrowserInputSchema,
  func: async ({ url, selector, waitForContent }) => {
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      
      // Set realistic user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      const waitUntil = waitForContent ? 'networkidle2' : 'domcontentloaded';
      await page.goto(url, { waitUntil, timeout: 30000 });

      let content = '';
      if (selector) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          content = await page.$eval(selector, (el) => el.textContent || '');
        } catch (e) {
          return `Error: Selector "${selector}" not found on page.`;
        }
      } else {
        content = await page.evaluate(() => document.body.innerText);
      }

      // Cleanup whitespace
      return content.replace(/\s+/g, ' ').trim().slice(0, 15000); // Limit output size
    } catch (error) {
      return `Error browsing ${url}: ${(error as Error).message}`;
    } finally {
      if (browser) await browser.close();
    }
  },
});
