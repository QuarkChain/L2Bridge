<template>
  <div class="home">
    <div class="asset">
      <p class="asset-title">Asset</p>
      <el-dropdown trigger="click" @command="onSelectAsset">
        <div class="asset-select">
          <img class="asset-icon" :src="currentCoin.src"/>
          <div class="asset-text">{{ currentCoin.label }}</div>
          <i class="el-icon-arrow-down el-icon--right asset-caret"></i>
        </div>
        <el-dropdown-menu slot="dropdown" class="asset-drop-menu">
          <el-dropdown-item v-for="item in coins" :key="item.value" :command="item" class="asset-item">
            <img class="asset-item-icon" :src="item.src"/>
            <span class="asset-item-text">{{ item.label }}</span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </el-dropdown>
    </div>

    <!--  from  -->
    <el-card shadow="always" class="from-card">
      <div class="card-item">
        <span class="card-item-title">
          From
        </span>
        <span class="card-item-balance" @click="onMax">
          Balance：{{ tokenBalanceStr }}
        </span>
      </div>
      <div class="card-item" style="margin-top: 28px">
        <el-dropdown trigger="click" @command="onSelectFromNetwork">
          <div v-if="fromNetwork!==null" class="card-select">
            <img class="asset-icon" :src="fromNetwork.src"/>
            <div class="asset-text card-select-text">{{ fromNetwork.label }}</div>
            <i class="el-icon-arrow-down el-icon--right card-select-caret"></i>
          </div>
          <div v-else class="asset-select card-select-empty">
            <div class="asset-text card-default-text">Select Network</div>
            <i class="el-icon-arrow-down el-icon--right card-default-caret"></i>
          </div>
          <el-dropdown-menu slot="dropdown" class="asset-drop-menu">
            <el-dropdown-item v-for="item in networks" :key="item.value" :command="item" class="asset-item">
              <img class="asset-item-icon" :src="item.src"/>
              <span class="asset-item-text">{{ item.label }}</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </el-dropdown>

        <el-input v-model="inputFrom" class="card-input" placeholder="0.00"
          oninput="value=value.replace(/。/g, '.').replace(/[^\d.]/g, '')
          .replace(/\.{2,}/g, '.').replace(/^\./g, '')
          .replace('.', '$#$').replace(/\./g, '').replace('$#$', '.')">
          <span slot="suffix" class="el-input__icon input-label">{{ currentCoin.label }}</span>
        </el-input>
      </div>
    </el-card>

    <img class="replace" src="../assets/replace.png" @click="onChaneNetwork"/>

    <!--  to  -->
    <el-card shadow="always" class="from-card">
      <div class="card-item-title" style="text-align: left">
        To (Minimum)
      </div>
      <div class="card-item" style="margin-top: 28px">
        <el-dropdown trigger="click" @command="onSelectToNetwork">
          <div v-if="toNetwork!==null" class="card-select">
            <img class="asset-icon" :src="toNetwork.src"/>
            <div class="asset-text card-select-text">{{ toNetwork.label }}</div>
            <i class="el-icon-arrow-down el-icon--right card-select-caret"></i>
          </div>
          <div v-else class="asset-select card-select-empty">
            <div class="asset-text card-default-text">Select Network</div>
            <i class="el-icon-arrow-down el-icon--right card-default-caret"></i>
          </div>
          <el-dropdown-menu slot="dropdown" class="asset-drop-menu">
            <el-dropdown-item v-for="item in networks" :key="item.value" :command="item" class="asset-item">
              <img class="asset-item-icon" :src="item.src"/>
              <span class="asset-item-text">{{ item.label }}</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </el-dropdown>
        <div>
          <span class="input-label" style="margin-left: 10px; margin-right: 10px">{{ toCoinBalance }}</span>
          <span class="input-label">{{ currentCoin.label }}</span>
        </div>
      </div>
    </el-card>


    <!--  info  -->
    <el-card shadow="always" class="from-card">
      <div class="card-item-title" style="text-align: left">
        Options
      </div>
      <div class="card-item" style="margin-top: 18px">
        <span class="info-label">Expire Period: </span>
        <el-input v-model="inputExpire" class="info-input" oninput="value=value.replace(/[^\d]/g,'')" placeholder="0">
          <span slot="suffix" class="el-input__icon info-input-label">sec</span>
        </el-input>
      </div>
      <div class="card-item" style="margin-top: 10px">
        <span class="info-label">Ramp-up Period: </span>
        <el-input v-model="inputRamp" class="info-input" oninput="value=value.replace(/[^\d]/g,'')" placeholder="0">
          <span slot="suffix" class="el-input__icon info-input-label">sec</span>
        </el-input>
      </div>
      <div class="card-item" style="margin-top: 10px">
        <span class="info-label">Max LP Fee: </span>
        <el-input v-model="inputMaxFee" class="info-input" oninput="value=value.replace(/[^\d]/g,'')" placeholder="0">
          <span slot="suffix" class="el-input__icon info-input-label">‱</span>
        </el-input>
      </div>
      <div class="card-item" style="margin-top: 18px">
        <span class="info-label">Bridge Fee: </span>
        <span class="info-label" style="margin-left: 20px">5 ‱</span>
      </div>
    </el-card>


    <!--  action  -->
    <button v-if="!this.account" class="btn-send" @click.stop="onConnectWallet">
      Connect Wallet
    </button>
    <button v-else-if="this.isChainNotSupported" class="btn-send" @click.stop="onSwitchNetwork">
      Switch Network
    </button>
    <button v-else-if="this.tokenAllowance===0" class="btn-send" @click.stop="onApprove">
      Approve
    </button>
    <button v-else class="btn-send" :disabled="isSendDisable" @click.stop="onSend">
      Send
    </button>
  </div>
</template>

<script>
import BigNumber from 'bignumber.js';
import {chainInfos} from "@/store/state";
import {toBaseUnitBN, toTokenUnitsBN} from '@/utils/numbers';
import {
  getAllowance, getEthBalance, getBalance,
  setAllowance, sendToken,
} from '@/utils/home';
import Bus from '@/utils/eventBus';

export default {
  name: 'Home',
  data: () => {
    return {
      currentCoin: {value: 'USDC', label: 'USDC', src: require('@/assets/token/usdc.png')},
      coins: [
        // {value: 'ETH', label: 'ETH', src: require('@/assets/token/eth.png')},
        {value: 'USDC', label: 'USDC', src: require('@/assets/token/usdc.png')},
        {value: 'USDT', label: 'USDT', src: require('@/assets/token/usdt.png')},
      ],

      networks: [
        // {value: 'optimism', label: 'Optimism', src: require('@/assets/optimism.png'), chainId: '0xa'},
        // {value: 'arbitrum', label: 'Arbitrum', src: require('@/assets/arbitrum.svg'), chainId: '0xa4b1'},
        {value: 'optimism1', label: 'Optimism1', src: require('@/assets/optimism.png'), chainId: '0x45'},
        {value: 'optimism2', label: 'Optimism2', src: require('@/assets/optimism.png'), chainId: '0x45'},
      ],
      fromNetwork: null,
      toNetwork: null,
      inputFrom: '',

      inputExpire: 8 * 24 * 60 * 60,
      inputRamp: 2 * 60 * 60,
      inputMaxFee: 5,

      loadInterval: undefined,
    };
  },
  created() {
    const token = this.$route.query.token;
    if (token) {
      const temp = this.coins.find((v) => v.value === token.toUpperCase());
      if (temp) {
        this.currentCoin = temp;
      }
    }
    const fromNetwork = this.$route.query.sourceNetwork;
    if (fromNetwork) {
      const temp = this.networks.find((v) => v.value === fromNetwork.toLowerCase());
      if (temp) {
        this.fromNetwork = temp;
      }
    }
    const toNetwork = this.$route.query.destNetwork;
    if (toNetwork) {
      const temp = this.networks.find((v) => v.value === toNetwork.toLowerCase());
      if (temp) {
        this.toNetwork = temp;
      }
    }

    if (this.loadInterval) {
      clearInterval(this.loadInterval);
    }
    this.loadInterval = setInterval(this.loadData, 10000,);
  },
  computed: {
    account() {
      return this.$store.state.account;
    },
    chainId() {
      return this.$store.state.chainId;
    },
    isChainNotSupported() {
      return this.fromNetwork != null && this.chainId !== this.fromNetwork.chainId;
    },
    currentChainInfo() {
      if (this.fromNetwork == null) {
        return {};
      }
      return chainInfos.find((v) => v.chainName === this.fromNetwork.label);
    },
    isSendDisable() {
      return !this.fromNetwork || !this.toNetwork || this.isChainNotSupported
          || !this.inputFrom || Number(this.inputFrom) <= 0 || Number(this.inputFrom) > Number(this.tokenBalanceStr);
    },
    tokenBalanceStr() {
      return this.parseFixed(this.tokenBalance);
    },
    toCoinBalance() {
      if(this.inputFrom) {
        const lpFee = this.inputMaxFee || 0;
        let amount = toBaseUnitBN(this.inputFrom, 18)
            .times(new BigNumber(9995 - Number(lpFee)))
            .div(new BigNumber(10000));
        return Number(toTokenUnitsBN(amount, 18).toFixed(6, BigNumber.ROUND_DOWN));
      }
      return 0;
    }
  },
  asyncComputed: {
    tokenAllowance : {
      async get() {
        if (!this.account || !this.fromNetwork || !this.toNetwork || this.isChainNotSupported) {
          return -1;
        }
        if (this.currentCoin.value === 'ETH') {
          return 1;
        }
        const coin = this.currentChainInfo[this.currentCoin.value];
        const contractInfo = this.currentChainInfo.bridge.find((v) => v.destChainName === this.toNetwork.label);
        const allowance = await getAllowance(coin, contractInfo.src, this.account);
        return allowance.toNumber();
      },
      default: 0,
      watch: ["account", "currentChainInfo", "currentCoin"],
    },
    tokenBalance: {
      async get() {
        if (!this.account || !this.fromNetwork || this.isChainNotSupported) {
          return 0;
        }
        if (this.currentCoin.value === 'ETH') {
          const balance = await getEthBalance(this.account);
          return toTokenUnitsBN(balance, 18)
        }
        const coin = this.currentChainInfo[this.currentCoin.value];
        const balance = await getBalance(coin, this.account);
        return toTokenUnitsBN(balance, coin.decimals);
      },
      default: 0,
      watch: ["account", "chainId", "currentCoin"],
    }
  },
  methods: {
    loadData() {
      this.$asyncComputed.tokenAllowance.update();
      this.$asyncComputed.tokenBalance.update();
    },
    parseFixed(value) {
      if (isNaN(value)) {
        value = 0;
      }
      if (value instanceof BigNumber) {
        value = value.toString();
      }
      return new BigNumber(value).toFixed(2, BigNumber.ROUND_DOWN);
    },
    getParams() {
      const query = {};
      query.token = this.currentCoin.value;
      if (this.fromNetwork !== null) {
        query.sourceNetwork = this.fromNetwork.value;
      }
      if (this.toNetwork !== null) {
        query.destNetwork = this.toNetwork.value;
      }
      return query;
    },
    onSelectAsset(coin) {
      this.currentCoin = coin;
      this.$router.push({path: '/send', query: this.getParams()});
    },
    onSelectFromNetwork(network) {
      this.fromNetwork = network;
      if (this.toNetwork === this.fromNetwork) {
        this.toNetwork = this.networks.find((v) => v.value !== this.fromNetwork.value);
      }
      this.$router.push({path: '/send', query: this.getParams()});
    },
    onSelectToNetwork(network) {
      this.toNetwork = network;
      if (this.toNetwork === this.fromNetwork) {
        this.fromNetwork = this.networks.find((v) => v.value !== this.toNetwork.value);
      }
      this.$router.push({path: '/send', query: this.getParams()});
    },
    onChaneNetwork() {
      const temp = this.fromNetwork;
      this.fromNetwork = this.toNetwork;
      this.toNetwork = temp;
      this.$router.push({path: '/send', query: this.getParams()});
    },
    onConnectWallet() {
      window.ethereum
          .request({method: "eth_requestAccounts"})
          .then(()=>{})
          .catch(async (error) => {
            if (error.code === 4001) {
              this.$message.error('User rejected');
            } else {
              this.$message.error('Connect Error');
            }
          });
    },
    onSwitchNetwork() {
      window.ethereum
          .request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: this.currentChainInfo.chainId,
              chainName: this.currentChainInfo.chainName,
              rpcUrls: this.currentChainInfo.rpc,
              blockExplorerUrls: this.currentChainInfo.explorer,
              nativeCurrency: {name: 'ETH', symbol: 'ETH', decimals: 18},
            }],
          })
          .then(async () => {
            const newChainId = await window.ethereum.request({method: "eth_chainId"});
            if (this.fromNetwork.chainId !== newChainId) {
              this.$message.error('User rejected');
            }
          })
          .catch(() => {
            this.$message.error('Failed to setup the network in Metamask');
          });
    },
    onMax() {
      this.inputFrom = this.tokenBalanceStr;
    },
    async onApprove() {
      const coin = this.currentChainInfo[this.currentCoin.value];
      const contractInfo = this.currentChainInfo.bridge.find((v) => v.destChainName === this.toNetwork.label);
      const spender = contractInfo.src;
      const result = await setAllowance(coin, spender);
      if (result) {
        this.$asyncComputed.tokenAllowance.update();
        this.$notify({title: 'Transaction', message: "Approve Success", type: 'success'});
      } else {
        this.$notify.error({title: 'Transaction', message: "Approve Fail"});
      }
    },
    async onSend() {
      const notify = this.$notify({
        title: 'Transaction',
        dangerouslyUseHTMLString: true,
        message: '<p><span style="color: #4782D2; font-size: 18px"><i class="el-icon-loading"></i></span>&nbsp;&nbsp;&nbsp;Pending tx</p>',
        duration: 0
      });

      const contractInfo = this.currentChainInfo.bridge.find((v) => v.destChainName === this.toNetwork.label);
      const srcCoin = this.currentChainInfo[this.currentCoin.value];
      const toChainInfo = chainInfos.find((v) => v.chainName === this.toNetwork.label);
      const descCoin = toChainInfo[this.currentCoin.value];
      const result = await sendToken(
          contractInfo.src, srcCoin, descCoin, this.account,
          this.inputFrom, this.inputMaxFee||0, this.inputRamp||0, this.inputExpire||0
      );
      if (result.state) {
        result.srcContract = contractInfo.src;
        result.destRpc = contractInfo.destRpc;
        result.destContract = contractInfo.dest;
        result.destChainName = toChainInfo.chainName;
        result.symbol = this.currentCoin.value;
        result.showProgress = false;
        result.isSuccess = false;
        Bus.$emit('sendTx', result);
        this.$asyncComputed.tokenBalance.update();

        notify.close();
        this.$notify({title: 'Transaction', message: "Send Success", type: 'success'});
      } else {
        notify.close();
        this.$notify.error({title: 'Transaction', message: "Send Fail"});
      }
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.asset {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-top: 25px;
}
.asset-title {
  font-size: 20px;
  color: #000000;
  line-height: 16px;
  margin-right: 10px;
  font-family: AlibabaPuHuiTiB;
}

.asset-select {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  background: #000000;
  border-radius: 20px;
  border: 1px solid #000000;
  width: 125px;
  padding: 2px 3px;
  cursor: pointer;
}
.asset-select:hover {
  background-color: #00000090;
  border-color: #00000090;
}
.asset-icon {
  width: 32px;
  height: 32px;
}
.asset-text {
  font-size: 16px;
  color: #FFFFFF;
  line-height: 16px;
  flex-grow: 1;
  text-align: left;
  margin-left: 8px;
  font-family: AlibabaPuHuiTiR;
}
.asset-caret {
  color: white;
  margin-right: 7px;
}
.asset-drop-menu {
  background-color: black;
  border-radius: 15px;
}
.asset-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 15px;
}
.asset-item:hover {
  background-color: #333333 !important;
}
.asset-item-icon {
  width: 30px;
  height: 30px;
}
.asset-item-text {
  color: white;
  margin-left: 20px;
}


/* from and to card*/
.from-card {
  width: 520px;
  padding: 10px;
  border-radius: 20px;
  margin-top: 20px;
}

.card-item {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}
.card-item-title {
  font-size: 14px;
  color: #8D8477;
  line-height: 16px;
  font-family: AlibabaPuHuiTiM;
}
.card-item-balance {
  font-size: 14px;
  color: #000000;
  line-height: 16px;
  cursor: pointer;
  font-family: AlibabaPuHuiTiR;
}

.card-select {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  background: #ffffff;
  border-radius: 20px;
  border: 1px solid #000000;
  width: 155px;
  padding: 2px 3px;
  cursor: pointer;
}
.card-select:hover {
  border-color: #00000060 !important;
}
.card-select-text {
  font-size: 14px;
  color: #000000;
  line-height: 14px;
  margin-left: 6px;
}
.card-select-caret {
  color: #000000;
  margin-right: 7px;
}
.card-select-empty{
  width: 150px;
}
.card-default-text {
  font-size: 15px;
  line-height: 12px;
  color: white;
  padding: 10px 0;
  font-family: AlibabaPuHuiTiR;
}
.card-default-caret {
  color: white;
  margin-right: 5px;
}

.card-input {
  width: 167px;
}
.card-input >>> .el-input__inner {
  box-shadow: inset 0px 2px 6px 0px rgba(0, 0, 0, 0.1500);
  border-radius: 20px;
  font-size: 16px;
  color: #000000;
  line-height: 16px;
  padding-right: 55px;
  font-family: AlibabaPuHuiTiR;
}
.card-input >>> .el-input__inner:focus {
  border-color: black !important;
}
.input-label {
  font-size: 16px;
  color: #000000;
  padding-right: 7px;
  padding-top: 8px;
  font-family: AlibabaPuHuiTiR;
}


.replace {
  width: 30px;
  height: 30px;
  margin-top: 10px;
  margin-bottom: -10px;
  cursor: pointer;
}

.info-label {
  font-size: 14px;
  color: #000000;
  line-height: 16px;
  font-family: AlibabaPuHuiTiR;
}
.info-input {
  width: 110px;
}
.info-input >>> .el-input__inner {
  box-shadow: inset 0px 2px 6px 0px rgba(0, 0, 0, 0.1500);
  height: 30px;
  border-radius: 20px;
  padding-right: 40px;
  font-size: 14px;
  color: #000000;
  font-family: AlibabaPuHuiTiR;
}
.info-input >>> .el-input__inner:focus {
  border-color: black !important;
}
.info-input-label {
  font-size: 14px;
  color: #000000;
  padding-right: 5px;
  line-height: initial;
  font-family: AlibabaPuHuiTiR;
}


.btn-send {
  color: #FFFFFF;
  font-size: 18px;
  line-height: 25px;
  padding: 10px 25px;
  border: 0;
  background: #000000;
  border-radius: 36px;
  cursor: pointer;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  margin-top: 30px;
  margin-bottom: 20px;
  font-family: AlibabaPuHuiTiM;
}
.btn-send:hover {
  background-color: #00000090;
  border: 0;
}
.btn-send:disabled {
  background: #CCCCCC !important;
  cursor: not-allowed;
}

@media screen and (max-width: 420px) {
  .asset {
    margin-top: 15px;
  }
  .asset-title {
    font-size: 16px;
  }

  .from-card {
    width: 100%;
    margin-top: 30px;
    padding: 10px 0;
  }

  .card-select {
    width: 135px;
  }
  .card-select-empty{
    width: 135px;
  }
  .card-select-text {
    font-size: 12px;
    line-height: 12px;
  }
  .card-default-text {
    font-size: 12px;
    line-height: 12px;
  }

  .card-input {
    width: 150px;
  }
  .card-input >>> .el-input__inner {
    font-size: 14px;
    line-height: 14px;
    padding-right: 50px;
  }
  .input-label {
    font-size: 14px;
  }
}
</style>

<style>
.popper__arrow::after {
  border-bottom-color: black !important;
}
.navbar-menu {
  background: #F6F2EC;
}
</style>
