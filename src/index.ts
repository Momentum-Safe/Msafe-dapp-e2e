import { Executor } from "./executor";
import fs from "fs";
import path from "path";
import { downloadExtension } from "./bootstrap";

const appURL = 'http://localhost:3000';

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function loadWallets(walletDir:string) {
    const wallets = fs.readdirSync(walletDir);
    return wallets.map(wallet=>fs.readFileSync(path.join(walletDir,wallet))).map(data=>JSON.parse(data.toString()));
}

async function main() {
    const walletDatas = loadWallets('./wallets');
    const walletDirs = await Promise.all(walletDatas.map(({extensionID, name})=>downloadExtension(extensionID, name)))
    const run = async ()=>{
        const executor = await Executor.new(appURL, walletDatas[0], walletDirs[0]);
        await executor.run();
        await executor.close();
    }
    await Promise.all([run(), run()])
}

main();