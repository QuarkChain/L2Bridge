import { ethers } from "ethers";
import BigNumber from "bignumber.js";
import {getTokenAllowance, getTokenBalance, getETHBalance} from './infura';
import {approve, deposit} from "./web3";
import {toTokenUnitsBN, toBaseUnitBN} from './numbers';

export const getAllowance = async (token, spender, account) => {
    try {
        const allowance = await getTokenAllowance(token.address, spender, account);
        return toTokenUnitsBN(allowance, token.decimals);
    } catch (e) {
        return new BigNumber(0);
    }
}

export const getEthBalance = async (account) => {
    try {
        const balance = await getETHBalance(account);
        return new BigNumber(balance);
    } catch (e) {
        return new BigNumber(0);
    }
}

export const getBalance = async (token, account) => {
    try {
        const balance = await getTokenBalance(token.address, account);
        return new BigNumber(balance);
    } catch (e) {
        return new BigNumber(0);
    }
}


export const setAllowance = async (token, spender) => {
    try {
        return await approve(token.address, spender);
    } catch (e) {
        return false;
    }
}

export const sendToken = async (contract, srcToken, decToken, account, amount, fee, feeRampup, endTime) => {
    amount = ethers.BigNumber.from(toBaseUnitBN(amount, decToken.decimals).toString(10));
    const feeAmount = amount.mul(ethers.BigNumber.from(fee)).div(ethers.BigNumber.from(10000)).toBigInt().toString();
    const sendAmount = amount.mul(ethers.BigNumber.from(10000)).div(ethers.BigNumber.from(10005)).toBigInt().toString();
    const startTime = parseInt(new Date().getTime() / 1000);
    const expiration = startTime + Number(endTime);
    let para = {
        srcTokenAddress: srcToken.address,
        dstTokenAddress : decToken.address,
        destination: account,
        amount: sendAmount,
        fee: feeAmount,
        startTime: startTime,
        feeRampup: feeRampup,
        expiration: expiration
    };
    try {
        const result = await deposit(contract, para);
        if(result.status) {
            return {
                hash: result.transactionHash,
                state: 1,
                srcToken: srcToken.address,
                dstToken: decToken.address,
                destination: account,
                amount: ethers.BigNumber.from(sendAmount),
                fee: ethers.BigNumber.from(feeAmount),
                startTime: ethers.BigNumber.from(startTime),
                feeRampup: ethers.BigNumber.from(feeRampup),
                expiration: ethers.BigNumber.from(expiration),
                decimals: srcToken.decimals,
            };
        }
        return { state: 0 };
    } catch (e) {
        return { state: 0 };
    }
}
