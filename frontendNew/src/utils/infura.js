import Web3 from 'frontendnew/src/utils/web3';
import erc20Abi from '../abi/erc20.json';

let web3;
// eslint-disable-next-line no-undef
if (window.ethereum !== undefined) {
  // eslint-disable-next-line no-undef
  web3 = new Web3(ethereum);
}


/**
 *
 * @param {string} token address
 * @param {string} account address
 * @return {Promise<string>}
 */
export const getTokenBalance = async (token, account) => {
  if (account === '') return '0';
  const tokenContract = new web3.eth.Contract(erc20Abi, token);
  return tokenContract.methods.balanceOf(account).call();
};

export const getETHBalance = async (account) => {
  return web3.eth.getBalance(account);
};

/**
 *
 * @param {string} token address
 * @return {Promise<string>}
 */
export const getTokenTotalSupply = async (token) => {
  const tokenContract = new web3.eth.Contract(erc20Abi, token);
  return tokenContract.methods.totalSupply().call();
};

/**
 *
 * @param {string} token
 * @param {string} account
 * @param {string} spender
 * @return {Promise<string>}
 */
export const getTokenAllowance = async (token, spender, account) => {
  const tokenContract = new web3.eth.Contract(erc20Abi, token);
  return tokenContract.methods.allowance(account, spender).call();
};
