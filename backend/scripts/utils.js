const fs = require("fs");
const { L1_CHAIN_ID, DIRECTION } = process.env;
const storageFile = __dirname + `/../data/${L1_CHAIN_ID}/${DIRECTION}.json`;

function log(module, ...msg) {
    console.log(new Date().toLocaleString(), `[${module}]`, ...msg);
}

function err(module, ...msg) {
    console.error(new Date().toLocaleString(), `[${module}]`, ...msg);
}

const logMain = (...msg) => log("main", ...msg);
const logClaim = (...msg) => log("claim", ...msg);
const logSync = (...msg) => log("sync", ...msg);
const logWithdraw = (...msg) => log("withdraw", ...msg);

function replacer(key, value) {
    if (value instanceof Map) {
        return {
            dataType: 'Map',
            value: Array.from(value.entries()), // or with spread: value: [...value]
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

const saveStatus = (blockSrc, blockDst, pendingL1Msgs, claimedDeposits) => {
    const storage = { blockSrc, blockDst };
    storage.syncs = JSON.parse(JSON.stringify(pendingL1Msgs, replacer));
    storage.claims = JSON.parse(JSON.stringify(claimedDeposits, replacer));
    // logMain("storage", storage)
    fs.writeFileSync(storageFile, JSON.stringify(storage, null, 2), e => {
        if (e) {
            err("main", e);
        }
    });
}

const loadStatus = () => {
    let processedBlockSrc;
    let processedBlockDst;
    let pendingL1Msgs = new Map();
    let claimedDeposits = new Map();
    if (fs.existsSync(storageFile)) {
        const storage = require(storageFile);
        // logMain("Storage", storage);
        const { blockDst, blockSrc, syncs, claims } = storage;
        processedBlockDst = blockDst;
        processedBlockSrc = blockSrc;
        pendingL1Msgs = JSON.parse(JSON.stringify(syncs, replacer), reviver);
        claimedDeposits = JSON.parse(JSON.stringify(claims, replacer), reviver);
    } else {
        const dir = __dirname + `/../data/${L1_CHAIN_ID}/`;
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    return { processedBlockSrc, processedBlockDst, pendingL1Msgs, claimedDeposits }
}

module.exports = { logMain, logClaim, logSync, logWithdraw, err, saveStatus, loadStatus };