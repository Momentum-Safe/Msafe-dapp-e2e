/* eslint-disable import/no-extraneous-dependencies */
import { Browser, ElementHandle, Page } from 'puppeteer';
import { bootstrap } from './bootstrap';
import { Operator, WalletData } from './wallet';

export class Executor {
    currentPage: Page | undefined
    constructor(
        public readonly appUrl: string,
        public readonly browser: Browser,
        public readonly walletData: WalletData,
        public readonly extentionURI: string,
    ) {
    }

    async switchPage(page: Page | undefined) {
        page && await page.bringToFront();
        this.currentPage = page;
    }

    async openAppPage() {
        const page = await this.browser.newPage();
        await this.switchPage(page);
        await page.goto(this.appUrl, { waitUntil: 'load' });
        return page;
    }

    async openWalletPage() {
        const page = await this.browser.newPage();
        await this.switchPage(page);
        const prefix = 'chrome-extension://';
        const id = this.extentionURI.slice(prefix.length).split('/')[0];
        await page.goto(prefix+id+'/index.html', { waitUntil: 'domcontentloaded' });
        return page;
    }

    async walletPage(): Promise<Page> {
        return this.browser.waitForTarget(async target =>
            target.url().startsWith('chrome-extension://') && null !== await target.page()
        ).then(target => target.page()) as Promise<Page>;
    }

    async button(text: string) {
        const xpath = `//*[text()="${text}"]`;
        console.log('button:', xpath);
        const currentPage = this.currentPage!;
        console.log(currentPage.url());
        const found = await currentPage.waitForXPath(xpath, { visible: true });
        if (found === null) throw `button(${text}) not exist`;
        console.log('found:', await found.evaluate(el => (el as any).outerHTML));
        return found!;
    }

    async input(placeholderOrIndex: string | number, type:'input'|'textarea' = 'input') {
        const currentPage = this.currentPage!;
        if (typeof placeholderOrIndex === 'number') {
            const selector = type;
            const index = placeholderOrIndex;
            await currentPage.waitForSelector(selector);
            const inputs = await currentPage.$$(selector);
            console.log("inputs.length:", inputs.length);
            return inputs[index];
        }
        const placeholder = placeholderOrIndex;
        const selector = `${type}[placeholder="${placeholder}"]`;
        const input = await currentPage.waitForSelector(selector);
        return input;
    }

    async checkbox(index: number) {
        const selector = 'input[type=checkbox]';
        const currentPage = this.currentPage!;
        await currentPage.waitForSelector(selector);
        const checkboxs = await currentPage.$$(selector);
        return checkboxs[index];
    }

    async click(node: ElementHandle<Node>) {
        console.log('click')
        await node.evaluate((el: any) => el.click())
    }

    async type(node: ElementHandle<Node>, value: string) {
        console.log('type')
        await node.type(value);
    }

    async execute(operators: Operator[], env: { [key: string]: any }) {
        for (const operator of operators) {
            const [element, selector, action, arg] = operator;
            const node = await (this as any)[element](selector);
            const value = env[arg] || arg;
            await (this as any)[action](node, value);
        }
    }

    async walletCall(funcs: string | string[], env: { [key: string]: any } = {}) {
        const backup = this.currentPage;
        const walletPage = await this.walletPage();
        await this.switchPage(walletPage);
        if (typeof funcs === 'string') funcs = [funcs];
        for (const func of funcs) {
            const operators = this.walletData.functions[func];
            await this.execute(operators, env);
        }
        await this.switchPage(backup);
    }

    async run(follower: boolean, env: { [key: string]: any }) {
        // init wallet, import private
        await this.walletCall('init', env);
        await this.openAppPage();
        const click = (text: string) => this.button(text).then(button => this.click(button));
        // select wallet and approve
        await click(this.walletData.name).then(() => this.walletCall(['unlock', 'approve'], env));
        // register and wallet approve
        await click('Register').then(() => this.walletCall('approve'));
    }

    async transfer(toAddrs: string[], value: string, env: { [key: string]: any }) {
        const backup = this.currentPage;
        await this.walletCall('init', env);
        const page = await this.openWalletPage();
        await this.walletCall('unlock', env);
        const click = (text: string) => this.button(text).then(button => this.click(button));
        const type = (text: string | number, value: string) => this.input(text).then(input => this.type(input!, value));
        for (const to of toAddrs) {
            // wait balance flush
            await this.button('Aptos Coin');
            await click('Send');
            await type(0, value);
            await this.input(0, 'textarea').then(input=>this.type(input!, to));
            await click('Preview');
            await click('Confirm and Send');
            await page.reload();
        };
        await page.close();
        await this.switchPage(backup);
    }

    async close() {
        await this.browser.close();
    }

    static async new(appUrl: string, walletData: WalletData, walletDir: string): Promise<Executor> {
        const { browser, extentionURI } = await bootstrap(walletDir);
        return new Executor(appUrl, browser, walletData, extentionURI);
    }
}


function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}