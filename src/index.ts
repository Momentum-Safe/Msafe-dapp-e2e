import { Executor } from "./executor";
import fs from "fs";
import path from "path";
import { downloadExtension } from "./bootstrap";
import { AptosAccount, HexString } from "aptos";

//const appURL = 'http://localhost:3000';
const appURL = 'https://testnet.m-safe.io';

const extensionPasswd = "Msafe12345";
const faucetAccount = new AptosAccount(HexString.ensure(process.env.PRIKEY as string).toUint8Array());

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function loadWalletProfiles(walletDir: string) {
    const wallets = fs.readdirSync(walletDir);
    return wallets.map(wallet => fs.readFileSync(path.join(walletDir, wallet))).map(data => JSON.parse(data.toString()));
}

function newAptosAccount() {
    while (true) {
        const acc = new AptosAccount();
        if (acc.address().noPrefix()[0] !== '0') continue;
        return acc;
    }
}

function newTestAccounts() {
    return [newAptosAccount(), newAptosAccount()];
}

function prepareEnvs(accounts: AptosAccount[], to: string) {
    const owners = accounts.map(account => account.address().hex())
    return accounts.map(account => ({
        $privateKey: account.toPrivateKeyObject().privateKeyHex,
        $publicKey: account.toPrivateKeyObject().publicKeyHex,
        $address: account.address().hex(),
        $owners: owners.filter(owner => owner !== account.address().hex()),
        $password: extensionPasswd,
        $to: to,
    }));
}

async function main() {
    const walletProfiles = loadWalletProfiles('./wallets');
    const walletDirs = await Promise.all(walletProfiles.map(({ extensionID, name }) => downloadExtension(extensionID, name)))
    const walletEnvs = walletProfiles.map(() => {
        const accounts = newTestAccounts();
        return prepareEnvs(accounts, faucetAccount.address().hex())
    });
    const faucetEnv = prepareEnvs([faucetAccount], faucetAccount.address().hex())[0]
    const e2eTest = async (walletProfile: any, walletDir: string, walletEnv: any, follower: boolean) => {
        const executor = await Executor.new(appURL, walletProfile, walletDir, !follower);
        await executor.run(follower, walletEnv);
        await executor.close();
    }
    const transfer = async (toAddrs: string[], value: string[], walletProfile: any, walletDir: string, walletEnv: any, first: boolean) => {
        const executor = await Executor.new(appURL, walletProfile, walletDir, first);
        //await sleep(1<<30)
        await executor.transfer(toAddrs, value, walletEnv);
        await executor.close();
    }
    for (let i = 0; i < walletProfiles.length; i++) {
        const walletProfile = walletProfiles[i];
        const walletDir = walletDirs[i];
        const walletEnv = walletEnvs[i];
        await transfer(walletEnv.map(env => env.$address), ['0.2', '0.2'], walletProfile, walletDir, faucetEnv, true);
        await Promise.all([e2eTest(walletProfile, walletDir, walletEnv[0], false), e2eTest(walletProfile, walletDir, walletEnv[1], true)])
        await Promise.all([transfer([faucetEnv.$address], ['0.082'], walletProfile, walletDir, walletEnv[0], true), transfer([faucetEnv.$address], ['0.194'], walletProfile, walletDir, walletEnv[1], false)])
    }
}

main();