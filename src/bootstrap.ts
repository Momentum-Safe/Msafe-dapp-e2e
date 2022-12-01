/* eslint-disable import/no-extraneous-dependencies */
import puppeteer, { Page } from 'puppeteer';
import { download } from './downloader';


function sleep(ms:number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

export async function downloadExtension(extensionID: string, extensionName: string) {
    const userAgent = await puppeteer.launch({ headless: true }).then(browser => browser.userAgent().finally(() => browser.close()));
    const extensionDir = await download(userAgent, extensionID, extensionName);
    return extensionDir;
}

export async function bootstrap(extentionPath: string) {
    //const { devtools = false, slowMo = false, appUrl } = options;
    const browser = await puppeteer.launch({
        headless: false,
        devtools: false,
        slowMo: undefined,
        defaultViewport: null,
        args: ['--enable-remote-extensions', '--lang=en', '--override-language-detection=en', '--accept-lang=en',
            `--disable-extensions-except=${extentionPath}`, `--load-extension=${extentionPath}`,
            //'--start-maximized'
        ],
        ignoreDefaultArgs: ['--disable-extensions', '--enable-automation'],
    });
    await browser.waitForTarget(async target=>target.url().startsWith('chrome-extension://') && null !== await target.page()).then(target=>target.page()) as Page;
    const pages = await browser.pages();
    await Promise.all(pages.filter(page=>page.url()==='about:blank').map(page=>page.close()));
    
    return browser
};
