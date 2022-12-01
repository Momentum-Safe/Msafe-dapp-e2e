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
        $privateKey: '0x8284169a7564153e0d767176164db1466f5b2ba03abfd587702d44c7dda0a690',
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
    for(let i = 0; i < walletDatas.length; i++) {
        const walletData = walletDatas[i];
        const walletDir = walletDirs[i];
        const walletEnv = walletEnvs[i];
        await Promise.all([run(walletData, walletDir, walletEnv[0], false), run(walletData, walletDir, walletEnv[1], true)])
    }
}

main();