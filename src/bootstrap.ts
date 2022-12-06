/* eslint-disable import/no-extraneous-dependencies */
import puppeteer, { Page } from 'puppeteer';
import { download } from './downloader';

export async function downloadExtension(extensionID: string, extensionName: string) {
    const userAgent = await puppeteer.launch({ headless: true }).then(browser => browser.userAgent().finally(() => browser.close()));
    const extensionDir = await download(userAgent, extensionID, extensionName);
    return extensionDir;
}

export async function bootstrap(extentionPath: string, first: boolean) {
    //const { devtools = false, slowMo = false, appUrl } = options;
    const width = 720;
    const browser = await puppeteer.launch({
        headless: false,
        devtools: false,
        slowMo: undefined,
        //executablePath: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, // MacOS
        defaultViewport: null,
        args: ['--enable-remote-extensions', '--lang=en', '--override-language-detection=en', '--accept-lang=en',
            `--disable-extensions-except=${extentionPath}`, `--load-extension=${extentionPath}`,
            //'--start-maximized',
            `--window-size=${width},800`, `--window-position=${first ? 0 : width},0`
        ],
        ignoreDefaultArgs: ['--disable-extensions', '--enable-automation'],
    });
    const extPage = await browser.waitForTarget(async target => target.url().startsWith('chrome-extension://') && null !== await target.page()).then(target => target.page()) as Page;
    const extentionURI = extPage.url();
    const pages = await browser.pages();
    await Promise.all(pages.filter(page => page.url() === 'about:blank').map(page => page.close()));

    return {
        browser,
        extentionURI
    };
};
