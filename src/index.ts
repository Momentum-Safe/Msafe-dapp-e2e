import { Executor } from "./executor";
import fs from "fs";
import path from "path";
import { downloadExtension } from "./bootstrap";

const appURL = 'http://localhost:3000';
const extensionPasswd = "Msafe12345";
const faucetPrikey = process.env.PRIKEY;

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function loadWallets(walletDir:string) {
    const wallets = fs.readdirSync(walletDir);
    return wallets.map(wallet=>fs.readFileSync(path.join(walletDir,wallet))).map(data=>JSON.parse(data.toString()));
}

async function prepareEnvPairs() {
    return [{
        $privateKey: '0xb6b46bdc9ad59236f321c13017a024ea3a16b453315af3723a103795d6a3764d',
        $password: extensionPasswd,
        to: '0x8284169a7564153e0d767176164db1466f5b2ba03abfd587702d44c7dda0a690',
    }, {
        $privateKey: '0x8284169a7564153e0d767176164db1466f5b2ba03abfd587702d44c7dda0a691',
        $password: extensionPasswd,
        to: '0x8284169a7564153e0d767176164db1466f5b2ba03abfd587702d44c7dda0a690',
    }];
}

async function faucet(to:string) {
    
}

async function collect(to:string) {
    
}

async function main() {
    const walletDatas = loadWallets('./wallets');
    const walletDirs = await Promise.all(walletDatas.map(({extensionID, name})=>downloadExtension(extensionID, name)))
    const walletEnvs = await Promise.all(walletDatas.map(()=>prepareEnvPairs()));
    const run = async (walletData:any, walletDir:string, walletEnv:any, follower:boolean)=>{
        const executor = await Executor.new(appURL, walletData, walletDir);
        await executor.run(follower, walletEnv);
        await executor.close();
    }
    const transfer = async (toAddrs: string[], value: string, walletData:any, walletDir:string, walletEnv:any)=>{
        const executor = await Executor.new(appURL, walletData, walletDir);
        await executor.transfer(toAddrs, value, walletEnv);
        await sleep(1<<30);
        await executor.close();
    }
    for(let i = 0; i < walletDatas.length; i++) {
        const walletData = walletDatas[i];
        const walletDir = walletDirs[i];
        const walletEnv = walletEnvs[i];
        //await Promise.all([run(walletData, walletDir, walletEnv[0], false), run(walletData, walletDir, walletEnv[1], true)])
        await transfer(['0x5c7b342e9ee2e582ad16fb602e8ebb6ba39b3bfa02a4fd3865853b10dc75765f', '0x5c7b342e9ee2e582ad16fb602e8ebb6ba39b3bfa02a4fd3865853b10dc75765f'], '0.000001', walletData, walletDir, walletEnv[0]);
    }
}

main();