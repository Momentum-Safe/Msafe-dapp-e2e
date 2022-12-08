/* eslint-disable import/no-extraneous-dependencies */
import { Browser, ElementHandle, Page } from 'puppeteer';
import { bootstrap } from './bootstrap';
import { waitSignal, Signal, sendSignal } from './signals';
import { Operator, WalletProfile } from './wallet';

export class Executor {
    static DefaultTimeout = 2 * 60 * 1000;
    currentPage: Page | undefined;
    walletEnv: { [key: string]: any } = {};
    constructor(
        public readonly appUrl: string,
        public readonly browser: Browser,
        public readonly walletProfile: WalletProfile,
        public readonly extentionURI: string,
    ) {
    }

    async switchPage(page: Page | undefined) {
        page && await page.bringToFront();
        this.currentPage = page;
    }

    async openAppPage() {
        const page = await this.browser.newPage();
        await page.goto(this.appUrl, { waitUntil: 'load' });
        await page.setDefaultTimeout(Executor.DefaultTimeout);
        return page;
    }

    async openWalletPage() {
        const page = await this.browser.newPage();
        const prefix = 'chrome-extension://';
        const id = this.extentionURI.slice(prefix.length).split('/')[0];
        await page.goto(prefix + id + '/index.html', { waitUntil: 'domcontentloaded' });
        await page.setDefaultTimeout(Executor.DefaultTimeout);
        return page;
    }

    async walletPage(): Promise<Page> {
        return this.browser.waitForTarget(async target =>
            target.url().startsWith('chrome-extension://') && null !== await target.page()
        ).then(target => target.page()) as Promise<Page>;
    }

    async hasText(text: string, contain = false, index = 0, timeout = 1000): Promise<boolean> {
        const xpath = contain ? `(//*[contain(text(),"${text}")])[${index + 1}]` : `(//*[text()="${text}"])[${index + 1}]`;
        console.log('button:', xpath);
        const currentPage = this.currentPage!;
        try {
            const found = await currentPage.waitForXPath(xpath, { visible: true, timeout });
            return found !== null
        } catch {
            return false;
        }
    }

    async waitText(text: string, contain = false, index = 0) {
        return await this.button(text, contain, index);
    }

    async button(text: string, contain = false, index = 0) {
        const xpath = contain ? `(//*[contain(text(),"${text}")])[${index + 1}]` : `(//*[text()="${text}"])[${index + 1}]`;
        console.log('button:', xpath);
        const currentPage = this.currentPage!;
        const found = await currentPage.waitForXPath(xpath, { visible: true });
        if (found === null) throw `button(${text}) not exist`;
        //console.log('found:', await found.evaluate(el => (el as any).outerHTML));
        return await this.waitEnable(found);
    }

    async textarea(placeholderOrIndex: string | number) {
        return this.input(placeholderOrIndex, 'textarea');
    }

    async input(placeholderOrIndex: string | number, type: 'input' | 'textarea' = 'input') {
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

    async _click(node: ElementHandle<Node>) {
        console.log('click')
        await node.evaluate((el: any) => el.click())
    }

    async _type(node: ElementHandle<Node>, value: string) {
        console.log('type')
        await node.type(value);
        await sleep(1*value.length + 5);
        await this._blur(node);
    }

    async _blur(node: ElementHandle<Node>) {
        console.log('blur')
        await node.evaluate((el: any) => el.blur());
    }

    click(text: string) {
        return this.button(text).then(button => this._click(button));
    }

    clicks(texts: string[]) {
        return texts.reduce((t, text) => t.then(() => this.click(text)), Promise.resolve())
    }

    type(text: string | number, value: string) {
        return this.input(text).then(input => this._type(input!, value));
    }

    async waitEnable(node: ElementHandle<Node>) {
        let retry = Executor.DefaultTimeout / 100;
        while (retry-- > 0) {
            const property = await node.getProperty('disabled');
            const disabled = await property.jsonValue();
            if (!disabled) break;
            await sleep(100);
        };
        if (retry <= 0) throw "not enable";
        return node;
    }

    async execute(operators: Operator[], env: { [key: string]: any }) {
        for (const operator of operators) {
            const [element, selector, action, arg] = operator;
            const node = await (this as any)[element](selector);
            const value = env[arg] || arg;
            action && await (this as any)[`_${action}`](node, value);
        }
    }

    async walletCall(funcs: string | string[], env: { [key: string]: any } = this.walletEnv) {
        const backup = this.currentPage;
        const walletPage = await this.walletPage();
        await this.switchPage(walletPage);
        if (typeof funcs === 'string') funcs = [funcs];
        for (const func of funcs) {
            const operators = this.walletProfile.functions[func];
            await this.execute(operators, env);
        }
        await this.switchPage(backup);
    }

    async doRegister() {
        await this.click('Register');
        await this.walletCall('approve');
        await this.waitText('Success!');
    }

    async doWalletConnect() {
        await this.click(this.walletProfile.name);
        await this.walletCall('approve');
    }

    async doMsafeCreate() {
        await this.click('Create a Safe');
        await this.type(1, this.walletEnv.$owners[0]);
        await this.click('Next');
        await this.waitText('Your MSafe Wallet address:');
        await sleep(3000);
        await this.click('Sign').then(() => this.walletCall('approve'));
        await this.click('Submit').then(() => this.walletCall('approve'));
    }

    async doRefreshPendingCreation() {
        const textButton = await this.button('Every transaction need confirmation from');
        await textButton.evaluate((el: any) => el.nextSibling.nextSibling.nextSibling.click())
    }

    async doSelectMsafe() {
        // select msafe
        while (true) {
            const elem = await this.button('My Safes');
            const hasPending = await elem.evaluate((el: any) => el.parentElement.nextSibling.children.length > 0);
            if (hasPending) {
                await elem.evaluate((el: any) => el.parentElement.nextSibling.children[0].click());
                break;
            }
            await elem.evaluate((el: any) => el.nextSibling.click());
            await sleep(3000);
        }
    }

    async doSelectPendingMsafe() {
        while (true) {
            const elem = await this.button('Pending creation');
            const hasPending = await elem.evaluate((el: any) => el.parentElement.nextSibling.children.length > 0);
            if (hasPending) {
                await elem.evaluate((el: any) => el.parentElement.nextSibling.children[0].click());
                break;
            }
            await elem.evaluate((el: any) => el.nextSibling.click());
            await sleep(3000);
        }
    }

    async doAcceptPendingMsafe() {
        await this.click('Sign now')
        await sleep(100); // delay, or the martian wallet may throw error: 'Something went wrong'
        await this.walletCall('approve');
        await this.click('Submit').then(() => this.walletCall('approve'));
        const success = await this.waitText('Success');
        await success.evaluate((el: any) => el.parentElement.parentElement.parentElement?.querySelector('button').click());
    }

    async doInitTransaction() {
        await this.clicks(['New Transaction', 'Coin transfer']);
        await this.textarea(0).then(textarea => this._type(textarea!, this.walletEnv.$to))
        await this.type('Please enter amount', '0.095');
        await this.click('Review');
        await this.click('Submit').then(() => this.walletCall('approve'));
        await this.button('Submit', false, 1).then(submit => this._click(submit)).then(() => this.walletCall('approve'));
        await this.button('Transaction created');
    }

    async doApproveTransaction() {
        await this.click('Queue');
        if (!await this.hasText('Pending')) {
            await this.click('Refresh');
        }
        await this.click('Pending');
        await this.click('Confirm').then(() => this.walletCall('approve'));
        await this.click('Submit').then(() => this.walletCall('approve'));
        await this.button('Transaction sent!')
    }

    async doWaitTransaction(text: string = 'Send Coin') {
        await this.click('History');
        while (!await this.hasText(text)) {
            await this.click('Refresh');
            await sleep(1000);
        }
    }

    async doCheckTransactionSuccess(text: string = 'Send Coin') {
        const sendCoinItem = await this.button(text)
        const success = await sendCoinItem.evaluate((el: any) => el.parentElement.nextElementSibling.nextElementSibling.nextElementSibling.textContent == 'Success')
        if (!success) throw "not success";
        console.log("success!")
    }
    // unlock wallet and switch to testnet, then reload app page
    async initTestPages() {
        const appPage = this.openAppPage();
        const walletPage = await this.openWalletPage();
        await this.walletCall('unlock');
        await this.switchTestnet(walletPage);
        await appPage.then(page => page.reload().then(() => this.switchPage(page)));
        await walletPage.close();
    }

    async run(follower: boolean, env: { [key: string]: any }) {
        this.walletEnv = env;
        // init wallet, import private
        await this.walletCall('init');
        await this.initTestPages();

        // select a wallet to connect
        await this.doWalletConnect();

        await sleep(5000);
        // register and wallet approve
        await this.doRegister();

        if (!follower) {
            await waitSignal(Signal.Register);
            await this.doMsafeCreate();
            sendSignal(Signal.CreateMsafe);
            await waitSignal(Signal.CreateMsafeConfirm);
            await this.doRefreshPendingCreation();
            // select msafe
            await this.doSelectMsafe();
            await this.doInitTransaction();
            sendSignal(Signal.InitTransaction)
            await waitSignal(Signal.InitTransactionConfirm);
        } else {
            sendSignal(Signal.Register)
            await waitSignal(Signal.CreateMsafe);

            await this.doSelectPendingMsafe();
            await this.doAcceptPendingMsafe();
            sendSignal(Signal.CreateMsafeConfirm);
            await waitSignal(Signal.InitTransaction);
            await this.doApproveTransaction();
            sendSignal(Signal.InitTransactionConfirm);
        }

        const txText = 'Send Coin';
        await this.doWaitTransaction(txText);
        await this.doCheckTransactionSuccess(txText);
    }

    async switchTestnet(page: Page) {
        const backup = this.currentPage;
        await this.switchPage(page);
        /*
        while (true) {
            await this.clicks(['Aptos Mainnet 1', 'Aptos', 'Testnet']);
            if (await this.hasText('Aptos Testnet')) break;
        }*/
        await this.walletCall('switch_testnet');
        await this.switchPage(backup);
    }

    async transfer(toAddrs: string[], values: string[], env: { [key: string]: any }) {
        const backup = this.currentPage;
        await this.walletCall('init', env);
        const page = await this.openWalletPage();
        await this.walletCall('unlock', env);
        // switch to testnet
        await this.switchTestnet(page);
        await this.switchPage(page);
        console.log(toAddrs);
        for (let i = 0; i < toAddrs.length; i++) {
            const to = toAddrs[i];
            const value = values[i];
            console.log('transfer to:', to, value);
            // wait balance flush
            await page.reload();
            await this.walletCall('transfer', {$to: to, $amount: value});
        };
        await page.close();
        await this.switchPage(backup);
    }

    async close() {
        await this.browser.close();
    }

    static async new(appUrl: string, walletProfile: WalletProfile, walletDir: string, first: boolean): Promise<Executor> {
        const { browser, extentionURI } = await bootstrap(walletDir, first);
        return new Executor(appUrl, browser, walletProfile, extentionURI);
    }
}


function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}