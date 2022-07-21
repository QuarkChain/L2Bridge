import { ethers } from "ethers";

const BridgeContractInfo = {
  abi: [
    "function balanceOf(address owner) view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",

    "function deposit(tuple(address srcTokenAddress,address dstTokenAddress,address destination,uint256 amount,uint256 fee,uint256 startTime,uint256 feeRampup,uint256 expiration)) public",
    "function refund(tuple(address srcTokenAddress,address dstTokenAddress,address destination,uint256 amount,uint256 fee,uint256 startTime,uint256 feeRampup,uint256 expiration)) public",
    "function transferStatus(bytes32) public view returns (uint256)",
    "event Deposit(address srcTokenAddress,address dstTokenAddress,address indexed source,address destination,uint256 amount,uint256 indexed fee,uint256 indexed startTime,uint256 feeRampup,uint256 expiration)",

    "event Claim(bytes32 indexed transferDataHash,address indexed claimer,address srcTokenAddress,uint256 indexed amount)",
  ],
};

const UINT256_MAX = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

const getContract = (address, abi) => {
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const contract = new ethers.Contract(address, abi, provider);
  return contract.connect(provider.getSigner());
}


export const approve = async (contract, spender, amt = UINT256_MAX) => {
  const tokenContract = getContract(contract, BridgeContractInfo.abi);
  const tx = await tokenContract.approve(spender, amt);
  const receipt = await tx.wait();
  return receipt.status;
}

export const deposit = async (contract, para) => {
  const tokenContract = getContract(contract, BridgeContractInfo.abi);
  const tx = await tokenContract.deposit(para);
  return await tx.wait();
}

export const depositList = async (contract, account) => {
  const bridgeContract = getContract(contract, BridgeContractInfo.abi);
  const eventFilter = bridgeContract.filters.Deposit(null,null,account);
  return await bridgeContract.queryFilter(eventFilter);
}

export const transferStatus = async (event) => {
  const para = [
    event.srcToken,
    event.dstToken,
    event.destination,
    event.amount,
    event.fee,
    event.startTime,
    event.feeRampup,
    event.expiration
  ];
  const data = ethers.utils.defaultAbiCoder.encode(['address','address','address','uint256','uint256','uint256','uint256','uint256'],para);
  const transferDataHash = ethers.utils.keccak256(data);
  const bridgeContractSrc = getContract(event.srcContract, BridgeContractInfo.abi);

  // destRpc
  const provider = new ethers.providers.JsonRpcProvider(event.rpc);
  const bridgeContractDest = new ethers.Contract(event.destContract, BridgeContractInfo.abi, provider);
  const eventFilter = bridgeContractDest.filters.Claim(transferDataHash);

  const tokenContract = getContract(event.srcToken, BridgeContractInfo.abi);
  const [states, claimEvents, decimals, symbol] = await Promise.all([
    bridgeContractSrc.transferStatus(transferDataHash),
    bridgeContractDest.queryFilter(eventFilter),
    tokenContract.decimals(),
    tokenContract.symbol(),
  ]);
  return {
    blockNumber: event.blockNumber,
    hash: event.hash,
    srcToken: event.srcToken,
    dstToken: event.dstToken,
    destination: event.destination,
    amount: event.amount,
    fee: event.fee,
    startTime: event.startTime,
    feeRampup: event.feeRampup,
    expiration: event.expiration,
    decimals: decimals,
    symbol: symbol,
    srcContract: event.srcContract,
    destChainName: event.destChainName,
    showProgress: false,
    state: states.toNumber(),
    isSuccess: claimEvents ? claimEvents.length > 0 : false,
  };
}

export const refund = async (contract, para) => {
  const tokenContract = getContract(contract, BridgeContractInfo.abi);
  const tx = await tokenContract.refund(para);
  const receipt = await tx.wait();
  return receipt.status;
}
