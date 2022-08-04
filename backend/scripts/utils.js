const fs = require("fs");
const { L1_CHAIN_ID, DIRECTION } = process.env;
const storageFile = __dirname + `/../data/${L1_CHAIN_ID}/${DIRECTION}.json`;

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

const saveStatus = (blockSrc, blockDst, lastCount, claimedCountStatus) => {
    const storage = { blockSrc, blockDst, lastCount };
    storage.syncs = JSON.parse(JSON.stringify(claimedCountStatus, replacer));
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
    let lastCountSearched;
    let claimedCountStatus = new Map();
    if (fs.existsSync(storageFile)) {
        const storage = require(storageFile);
        // logMain("Storage", storage);
        const { blockDst, blockSrc, lastCount, syncs } = storage;
        processedBlockDst = blockDst;
        processedBlockSrc = blockSrc;
        lastCountSearched = lastCount;
        claimedCountStatus = JSON.parse(JSON.stringify(syncs, replacer), reviver);
    } else {
        const dir = __dirname + `/../data/${L1_CHAIN_ID}/`;
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    return { processedBlockSrc, processedBlockDst, lastCountSearched, claimedCountStatus }
}

module.exports = { logMain, logClaim, logSync, logWithdraw, err, saveStatus, loadStatus };