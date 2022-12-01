/* eslint-disable import/no-extraneous-dependencies */
import { Browser, ElementHandle, Page } from 'puppeteer';
import { bootstrap } from './bootstrap';
import { Operator, WalletData } from './wallet';

export class Executor {
    currentPage: Page|undefined
    constructor(
        public readonly appUrl: string,
        public readonly browser: Browser,
        public readonly walletData: WalletData,
    ) {
    }

    async switchPage(page: Page|undefined) {
        page && await page.bringToFront();
        this.currentPage = page;
    }

    async openAppPage() {
        const page = await this.browser.newPage();
        await this.switchPage(page);
        await page.goto(this.appUrl, {waitUntil: 'load'});
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
        if(found === null) throw `button(${text}) not exist`;
        console.log('found:', await found.evaluate(el=>(el as any).outerHTML));
        return found!;
    }

    async input(placeholderOrIndex: string | number) {
        const currentPage = this.currentPage!;
        if (typeof placeholderOrIndex === 'number') {
            const selector = `input`;
            const index = placeholderOrIndex;
            await currentPage.waitForSelector(selector);
            const inputs = await currentPage.$$(selector);
            return inputs[index];
        }
        const placeholder = placeholderOrIndex;
        const selector = `input[placeholder="${placeholder}"]`;
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

    async execute(operators: Operator[], env:{[key:string]:any}) {
        for(const operator of operators) {
            const [element, selector, action, arg] = operator;
            const node = await (this as any)[element](selector);
            const value = env[arg] || arg;
            await (this as any)[action](node, value);
        }
    }

    async walletCall(func: string, env:{[key:string]:any} = {}) {
        const backup = this.currentPage;
        const walletPage = await this.walletPage();
        await this.switchPage(walletPage);
        const operators = this.walletData.functions[func];
        await this.execute(operators, env);
        await this.switchPage(backup);
    }

    async run() {
        // init wallet, import private
        await this.walletCall('init', {$privateKey:'0x8284169a7564153e0d767176164db1466f5b2ba03abfd587702d44c7dda0a690'});
        await this.openAppPage();
        const click = (text: string) => this.button(text).then(button=>this.click(button));
        // select wallet
        await click(this.walletData.name);
        // unlock wallet
        await this.walletCall('unlock');
        // approve connect
        await this.walletCall('approve');
        // register
        await click('Register');
        // approve register transaction
        await this.walletCall('approve');
    }

    async close() {
        await this.browser.close();
    }

    static async new(appUrl: string, walletData: WalletData, walletDir: string): Promise<Executor> {
        const browser = await bootstrap(walletDir);
        return new Executor(appUrl, browser, walletData);
    }
}