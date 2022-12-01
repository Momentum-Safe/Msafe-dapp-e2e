
import fs from 'fs';
const fetch = require('node-fetch');
import extract from 'extract-zip';
import path from 'path';

function getChromeVersion(userAgent: string) {
    var pieces = userAgent.match(/Chrom(?:e|ium)\/([0-9]+)\.([0-9]+)\.([0-9]+)\.([0-9]+)/);
    if (pieces == null || pieces.length != 5) {
        return undefined;
    }
    const versions = pieces.map(piece => parseInt(piece, 10));
    // `${major}.${minor}.${build}.${patch}`
    return versions.slice(1, 5).join('.');
}

function getNaclArch(userAgent: string) {
    var nacl_arch = 'arm';
    if (userAgent.indexOf('x86') > 0) {
        nacl_arch = 'x86-32';
    } else if (userAgent.indexOf('x64') > 0) {
        nacl_arch = 'x86-64';
    }
    return nacl_arch;
}

function downloadUrl(userAgent: string, extensionID: string) {
    const version = getChromeVersion(userAgent);
    const nacl_arch = getNaclArch(userAgent);
    return `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=${version}&x=id%3D${extensionID}%26installsource%3Dondemand%26uc&nacl_arch=${nacl_arch}&acceptformat=crx2,crx3`;
}

function CrxToZIP(arraybuffer: ArrayBuffer) {
    var data = arraybuffer;
    var buf = new Uint8Array(data);
    var publicKeyLength, signatureLength, header, zipStartOffset;
    if (buf[4] === 2) {
        header = 16;
        publicKeyLength = 0 + buf[8] + (buf[9] << 8) + (buf[10] << 16) + (buf[11] << 24);
        signatureLength = 0 + buf[12] + (buf[13] << 8) + (buf[14] << 16) + (buf[15] << 24);
        zipStartOffset = header + publicKeyLength + signatureLength;
    } else {
        publicKeyLength = 0 + buf[8] + (buf[9] << 8) + (buf[10] << 16) + (buf[11] << 24 >>> 0);
        zipStartOffset = 12 + publicKeyLength;
    }
    // 16 = Magic number (4), CRX format version (4), lengths (2x4)
    return arraybuffer.slice(zipStartOffset)
}

async function unzipToDir(zipdata: ArrayBuffer, dir: string) {
    const zipFile = 'extension.zip';
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const zipPath = path.join(dir, zipFile);
    fs.writeFileSync(zipPath, new Uint8Array(zipdata));
    await extract(zipPath, { dir });
    await fs.rmSync(zipPath);
    return dir;
}

export async function download(userAgent: string, extensionID: string, extensionName: string) {
    const PWD = process.env.PWD as string;
    const extensionPath = path.join(PWD, 'extensions', extensionName);
    if (fs.existsSync(extensionPath)) return extensionPath;
    const url = downloadUrl(userAgent, extensionID);
    const response = await fetch(url);
    const crxBuffer = await response.arrayBuffer();
    const zipBuffer = CrxToZIP(crxBuffer);
    return await unzipToDir(zipBuffer, extensionPath);
}
