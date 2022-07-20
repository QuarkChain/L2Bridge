require("dotenv").config();

require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-web3");
require("hardhat-gas-reporter");
require("solidity-coverage");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const { INFURA_PROJECT_ID, PRIVATE_KEY, REPORT_GAS, ETHERSCAN_API_KEY, OPT_KOVAN_API_KEY } =
  process.env;

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.0",
  networks: {
    hardhat: {
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
    },
    arbitrum: {
      url: `https://arbitrum-rinkeby.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
    },
    optimisticKovan: {
      chainId: 69,
      url: `https://kovan.optimism.io/`,
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
    },
    bobaRinkeby: {
      chainId: 28,
      url: `https://rinkeby.boba.network/`,
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
    },
    arbitrumRinkeby: {
      chainId: 421611,
      url: `https://rinkeby.arbitrum.io/rpc`,
      accounts: PRIVATE_KEY !== undefined ? [PRIVATE_KEY] : [],
    }
  },
  gasReporter: {
    enabled: REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: {
      kovan: ETHERSCAN_API_KEY,
      optimisticKovan: OPT_KOVAN_API_KEY,
    }
  }
};
