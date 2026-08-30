import puppeteer from 'puppeteer';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();
  
  const shotPath = 'E:/Dev/DesktopCommanderMCP/logs/chrome_screenshot.png';
  await page.screenshot({ path: shotPath });
  console.log(`Screenshot saved to ${shotPath}`);
  console.log(`Current URL: ${page.url()}`);
  console.log(`Title: ${await page.title()}`);
  
  browser.disconnect();
}

main().catch(console.error);
