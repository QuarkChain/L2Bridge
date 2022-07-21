import {refund, depositList, transferStatus} from "./web3";
const { from, mergeMap } = require('rxjs');

export const getEventList = async (bridgeArray, account) => {
  const eventList = [];
  const events = await getEventAllList(bridgeArray, account);
  return new Promise((resolve,) => {
    from(events)
    .pipe(mergeMap(event => transferStatus(event), 20))
    .subscribe(
      (info) => {eventList.push(info)},
      (e) => {console.log(e)},
      () => {
          eventList.sort((a, b) => {
              return Number(b.blockNumber) - Number(a.blockNumber);
          });
          resolve(eventList);
      });
    });
}

const getEventAllList = async (bridgeArray, account) => {
  const request = bridgeArray.map(bridge => getEvents(bridge, account));
  const results = await Promise.all(request);
  let events = [];
  if(events){
    for(const eventList of results){
      events = events.concat(eventList);
    }
  }
  return events;
}

const getEvents = async (bridge, account) => {
  const events = await depositList(bridge.src, account);
  return events.map(event => {
    return {
        blockNumber: event.blockNumber,
        hash: event.transactionHash,
        srcContract: bridge.src,
        destContract: bridge.dest,
        rpc: bridge.destRpc,
        destChainName: bridge.destChainName,
        srcToken: event.args.srcTokenAddress,
        dstToken: event.args.dstTokenAddress,
        destination: event.args.destination,
        amount: event.args.amount,
        fee: event.args.fee,
        startTime: event.args.startTime,
        feeRampup: event.args.feeRampup,
        expiration: event.args.expiration,
    };
  });
}

export const refundTx = async (contract, srcToken, decToken, account, amount, fee, startTime, feeRampup, expiration) => {
    let para = {
        srcTokenAddress: srcToken,
        dstTokenAddress : decToken,
        destination: account,
        amount: amount,
        fee: fee,
        startTime: startTime,
        feeRampup: feeRampup,
        expiration: expiration
    };
    try {
        return await refund(contract, para);
    } catch (e) {
        return false;
    }
}
