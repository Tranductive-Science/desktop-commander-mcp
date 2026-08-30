import puppeteer from 'puppeteer';
import path from 'node:path';

const userDataDir = 'E:/Dev/DesktopCommanderMCP/chrome-profile';
const screenshotPath = 'E:/Dev/DesktopCommanderMCP/logs/chatgpt_desktop.png';

export async function captureChatGPT(action = 'screenshot', targetUrl = 'https://chatgpt.com') {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    userDataDir,
    defaultViewport: null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--start-maximized'
    ]
  });

  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();

  if (page.url() === 'about:blank' || (targetUrl && !page.url().includes('chatgpt.com'))) {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  }

  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: screenshotPath });

  const info = {
    url: page.url(),
    title: await page.title(),
    screenshot: screenshotPath
  };

  console.log(JSON.stringify(info, null, 2));
  return { browser, page, info };
}

captureChatGPT().then(() => {
  console.log('Capture completed.');
  process.exit(0);
}).catch(err => {
  console.error('Automation error:', err);
  process.exit(1);
});
