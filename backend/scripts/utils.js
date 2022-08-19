const fs = require("fs");
const fetch = require("node-fetch");
const { L1_CHAIN_ID, DIRECTION } = process.env;
const storageFile = __dirname + `/../data/${L1_CHAIN_ID}/${DIRECTION}.json`;


let cachePrices = {};
let cacheGasPrice;

function log(module, ...msg) {
    console.log(new Date().toLocaleString().replace(', ', '|').replace(' ', ''), `[${module}]`, ...msg);
}

function err(module, ...msg) {
    console.error(new Date().toLocaleString().replace(', ', '|').replace(' ', ''), `[${module}]`, ...msg);
}

const logMain = (...msg) => log("main", ...msg);
const logClaim = (...msg) => log("claim", ...msg);
const logSync = (...msg) => log("sync", ...msg);
const logWithdraw = (...msg) => log("withdraw", ...msg);

function replacer(key, value) {
    if (value instanceof Map) {
        return {
            dataType: 'Map',
            value: [...value]
        };
    } else {
        return value;
    }
}

function reviver(key, value) {
    if (typeof value === 'object' && value !== null) {
        if (value.dataType === 'Map') {
            return new Map(value.value);
        }
    }
    return value;
}

const saveStatus = (blockSrc, lastBlock, lastCount, claimedCountStatus) => {
    const storage = { blockSrc, lastBlock, lastCount };
    storage.syncs = JSON.parse(JSON.stringify(claimedCountStatus, replacer));
    fs.writeFileSync(storageFile, JSON.stringify(storage, null, 2), e => {
        if (e) {
            err("main", e);
        }
    });
}

const loadStatus = () => {
    let processedBlockSrc, lastSearchedBlock, lastSearchedCount;
    let claimedCountStatus = new Map();
    if (fs.existsSync(storageFile)) {
        const { blockSrc, lastBlock, lastCount, syncs } = require(storageFile);
        lastSearchedBlock = lastBlock;
        lastSearchedCount = lastCount;
        processedBlockSrc = blockSrc;
        claimedCountStatus = JSON.parse(JSON.stringify(syncs, replacer), reviver);
    } else {
        const dir = __dirname + `/../data/${L1_CHAIN_ID}/`;
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    return { processedBlockSrc, lastSearchedBlock, lastSearchedCount, claimedCountStatus }
}

async function tokenPrice(tokenAddress) {
    tokenAddress = tokenAddress.toLowerCase();
    try {
        const url = `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${tokenAddress}&vs_currencies=usd`
        const resp = await fetch(url);
        const data = await resp.json();
        if (data[tokenAddress]) {
            const price = data[tokenAddress].usd.toFixed(2);
            cachePrices[tokenAddress] = price;
            logClaim(`price of ${tokenAddress}`, price);
            return price;
        }
    } catch (e) {
        logClaim(`get token price failed`, tokenAddress, e.code ? e.code : e);
    }
    return cachePrices[tokenAddress] || 1;
}

async function fastGasPrice() {
    try {
        const url = `https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${ETHERSCAN_API_KEY}`
        const resp = await fetch(url);
        const data = await resp.json();
        const price = data.result.FastGasPrice;
        cacheGasPrice = price;
        logSync(`fastGasPrice`, fastGasPrice);
        return price;
    } catch (e) {
        logSync(`get gas price failed`, e.code ? e.code : e);
        return cacheGasPrice;
    }
}

class NonceManager {
    constructor(startNonce) {
        this.nonceOffset = 0;
        // this.provider = signer.provider;
        // this.address = signer.address;
        this.baseNonce = startNonce;
    }

    // async baseNonce() {
    //     return await this.provider.getTransactionCount(this.address);
    // }

    getNonce() {
        // const nonce = this.baseNonce.then((nonce) => {
        //     console.log("baseNonce called")
        //     return (nonce + (this.nonceOffset++));
        // });
        console.log('nonceOffset', this.nonceOffset)
        const nonce = this.baseNonce + (this.nonceOffset++);
        return nonce;
        // const bn =   this.baseNonce();
        // const nonce = bn + this.nonceOffset++;
        // console.log("baseNonce", bn, "offset", this.nonceOffset, "nonce", nonce)
        // return nonce;
    }
}

module.exports = { logMain, logClaim, logSync, logWithdraw, err, saveStatus, loadStatus, tokenPrice };