
export enum Signal {
    Nonce = 0,
    Register,
    CreateMsafe,
    CreateMsafeConfirm,
    InitTransaction,
    InitTransactionConfirm,
}

const signals = {} as { [sig: number]: { thresold: number, count: number, resolve?: (v: any) => void } };

export const sendSignal = (sig: Signal) => {
    if (signals[sig] === undefined) {
        signals[sig] = { thresold: 0, count: 1 };
    } else {
        signals[sig].count++;
        if (signals[sig].count >= signals[sig].thresold && signals[sig].resolve !== undefined) {
            signals[sig].resolve!(signals[sig].count);
        }
    }
}

export const waitSignal = (sig: Signal, thresold = 1) => {
    if (signals[sig] === undefined) {
        signals[sig] = { thresold: 0, count: 0 };
    }
    signals[sig].thresold = thresold;
    return signals[sig].count >= thresold
        ? Promise.resolve()
        : new Promise((resolve) => signals[sig].resolve = resolve);

}
