export type Operator = (string | number)[];
export type WalletProfile = {
    name: string,
    extensionID: string,
    env: string[],
    functions: { [func: string]: Operator[] }
}