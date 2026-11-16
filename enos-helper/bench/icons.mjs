// Icones : un « e » sobre sur fond petrole, 4 tailles.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#1f6f78"/><text x="64" y="94" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="92" fill="#fff">e</text></svg>`;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
for (const s of [16, 32, 48, 128]) {
  await page.setViewport({ width: s, height: s, deviceScaleFactor: 1 });
  await page.setContent(`<body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${s}" height="${s}"></body>`);
  await page.screenshot({ path: `icons/${s}.png`, omitBackground: true });
}
await browser.close();
