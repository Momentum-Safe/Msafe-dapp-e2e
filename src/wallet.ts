export type Operator = (string|number)[];
export type WalletData = {
    name: string,
    extensionID: string,
    env: string[],
    functions: {[func:string]:Operator[]}
}