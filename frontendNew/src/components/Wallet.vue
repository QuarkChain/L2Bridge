<template>
  <div id="wallet">
    <button
      class="btn-connect"
      v-if="this.currentAccount == null"
      @click.stop="connectWallet"
    >
      Connect Wallet
    </button>
    <div v-else class="user">
      <div class="favorite" @click.stop="openTxList"/>
      <div class="account">
        {{ this.accountShort }}
      </div>
    </div>

    <el-dialog :visible="this.showDialog"
               :modal-append-to-body="false"
               @close="closeTxList"
               class="dialog_card"
               width="560px">
      <div slot="title" class="dialog_title">History</div>
      <div v-if="eventList.length>0" class="dialog-list">
        <div class="dialog_layout" v-for="(item) of eventList" :key="item.hash">
          <div class="dialog-item">
            <span class="dialog-item-text">Status：</span>
            <span v-if="item.isSuccess" class="dialog-item-text dialog-success">
              Completed&#32;&#32;<img width="15" height="15" src="frontendnew/src/assets/success.png"/>
            </span>
            <span v-else-if="isFail(item.state, item.expiration)" class="dialog-item-text dialog-fail">
              Expired&#32;&#32;<img width="15" height="15" src="frontendnew/src/assets/fail.png"/>
            </span>
            <span v-else class="dialog-item-text dialog-pending">
              Pending&#32;&#32;<img width="15" height="15" src="frontendnew/src/assets/pending.png"/>
            </span>
          </div>
          <div class="dialog-item">
            <span class="dialog-item-text">Transaction Hash：</span>
            <span class="dialog-item-text dialog-pending" style="cursor: pointer" @click="openHash(item.hash)">
              {{ textShort(item.hash) }}
            </span>
          </div>
          <div class="dialog-item">
            <span class="dialog-item-text">Amount：</span>
            <span
                class="dialog-item-text">{{ amountSrc(item.amount, item.decimals) }} {{ item.symbol.toUpperCase() }}
            </span>
          </div>
          <div class="dialog-item">
            <span class="dialog-item-text">Source：</span>
            <span class="dialog-item-text">{{ fromChainName }}</span>
          </div>
          <div class="dialog-item">
            <span class="dialog-item-text">Destination：</span>
            <span class="dialog-item-text">{{ item.destChainName }}</span>
          </div>
          <div class="dialog-item">
            <span class="dialog-item-text">Expired Time：</span>
            <span class="dialog-item-text">{{ timeSrc(item.expiration) }}</span>
          </div>
          <div class="dialog-item">
            <el-button class="dialog-btn"
                       :loading="item.showProgress"
                       :disabled="!canRefund(item)"
                       @click.stop="onRefund(item)">
              Refund
            </el-button>
          </div>
        </div>
      </div>
      <div v-else class="empty-text">
        Empty Result!
      </div>
    </el-dialog>
  </div>
</template>

<script>
import BigNumber from "bignumber.js";
import { mapActions } from "vuex";
import {chainInfos} from "@/store/state";
import {refundTx, getEventList} from "@/utils/walet";
import {toTokenUnitsBN} from '@/utils/numbers';
import Bus from '@/utils/eventBus';

export const XFER_PENDING = 1;
export const XFER_EXPIRED = 2;
export const XFER_DONE = 3;

export default {
  name: "Wallet",
  data: () => ({
    networkId: null,
    currentAccount: null,

    showDialog: false,
  }),
  async created() {
    this.connectWallet();
    window.ethereum.on("chainChanged", this.handleChainChanged);
    window.ethereum.on("accountsChanged", this.handleAccountsChanged);

    Bus.$on('sendTx', value => {
      this.eventList = [value].concat(this.eventList);
    });
  },
  computed: {
    accountShort() {
      return this.textShort(this.currentAccount);
    },
    currentNetworkName() {
      return this.$route.query.sourceNetwork;
    },
    currentChainInfo() {
      if (!this.networkId) {
        return undefined;
      }
      if (this.currentNetworkName) {
        let chainInfo = chainInfos.find((v) => v.chainName.toLowerCase() === this.currentNetworkName.toLowerCase());
        if(chainInfo && chainInfo.chainId === this.networkId){
          return chainInfo;
        }
      }
      return chainInfos.find((v) => v.chainId === this.networkId);
    },
    fromChainName() {
      if(this.currentChainInfo) {
        return this.currentChainInfo.chainName;
      }
      return undefined;
    },
    fromChainExplorer() {
      if(this.currentChainInfo) {
        return this.currentChainInfo.explorer;
      }
      return undefined;
    }
  },
  asyncComputed: {
    eventList: {
      async get() {
        if (!this.currentAccount || !this.networkId || !this.currentChainInfo) {
          return [];
        }
        return await getEventList(this.currentChainInfo.bridge, this.currentAccount);
      },
      default: [],
      watch: ["currentAccount", "networkId", "currentNetworkName"],
    }
  },
  methods: {
    ...mapActions(["setChainId", "setAccount"]),
    connectWallet() {
      if (!window.ethereum) {
        this.$message.error('Can\'t setup the Web3Q network on metamask because window.ethereum is undefined');
        return;
      }
      this.login();
    },
    async login() {
      window.ethereum
          .request({ method: "eth_requestAccounts" })
          .then(this.handleAccountsChanged)
          .catch(async (error) => {
            if (error.code === 4001) {
              this.$message.error('User rejected');
            } else {
              this.$message.error('Connect Error');
            }
          });
    },
    async handleChainChanged() {
      const newChainId = await window.ethereum.request({ method: "eth_chainId" });
      this.networkId = newChainId;
      this.setChainId(newChainId);
    },
    async handleAccountsChanged(accounts) {
      // if account is connect, not call chain changed, so this call
      await this.handleChainChanged();

      // account
      if (accounts.length === 0) {
        this.currentAccount = null;
        this.setAccount('');
        console.warn(
          "MetaMask is locked or the user has not connected any accounts"
        );
        return;
      }
      if (accounts[0] !== this.currentAccount) {
        this.currentAccount = accounts[0];
        this.setAccount(accounts[0]);
      }
    },
    openTxList(){
      this.showDialog = true;
    },
    closeTxList() {
      this.showDialog = false;
    },
    textShort(text) {
      return (
          text.substring(0, 6) +
          "..." +
          text.substring(text.length - 4,text.length)
      );
    },
    amountSrc(value, decimals) {
      value = new BigNumber(value.toString());
      value = value.plus(value.times(new BigNumber(5)).div(new BigNumber(10000)));
      value = toTokenUnitsBN(value, decimals);
      return value.toFixed(2, BigNumber.ROUND_DOWN);
    },
    timeSrc(time) {
      time = new Date(time.toNumber() * 1000)
      return time.toLocaleDateString(undefined, {
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    },
    isFail(state, expiration) {
      // has claimed
      if(state === XFER_EXPIRED){
        return true;
      }
      const currentTime = new Date().getTime() / 1000;
      return currentTime > expiration.toNumber();
    },
    canRefund(item) {
      const currentTime = new Date().getTime() / 1000;
      return !item.isSuccess && item.state !== XFER_EXPIRED && currentTime > item.expiration.toNumber();
    },
    async onRefund(item) {
      item.showProgress = true;
      const result = await refundTx(
          item.srcContract,
          item.srcToken, item.dstToken, item.destination,
          item.amount, item.fee, item.startTime, item.feeRampup, item.expiration
      );
      if(result) {
        item.state = XFER_EXPIRED;
      }
      item.showProgress = false;
    },
    openHash(hash) {
      const url = this.fromChainExplorer + "tx/" + hash;
      window.open(url, "_blank");
    }
  },
};
</script>

<style scoped>
#wallet {
  display: flex;
  justify-content: center;
}

.user{
  display: flex;
  flex-direction: row;
  align-items: center;
}
.account {
  font-size: 15px;
  line-height: 15px;
  padding: 10px 15px;
  background: #FFFFFF;
  border-radius: 36px;
  border: 1px solid #E8E6F2;
  text-align: center;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  font-family: AlibabaPuHuiTiM;
}
.favorite{
  cursor: pointer;
  height: 24px;
  width: 24px;
  margin-right: 20px;
  padding: 0;
  background-image: url("frontendnew/src/assets/history.png");
  background-repeat:no-repeat;
  background-size:100% 100%;
  -moz-background-size:100% 100%;
}

.btn-connect {
  color: #ffffff;
  font-size: 15px;
  line-height: 15px;
  padding: 10px 15px;
  border: 0;
  background: #000000;
  border-radius: 36px;
  cursor: pointer;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  font-family: AlibabaPuHuiTiM;
}
.btn-connect:hover {
  background-color: #00000090;
  border: 0;
}


.dialog_card {
}
.dialog_card >>> .el-dialog{
  border-radius: 16px;
}
.dialog_card >>> .el-dialog__close:hover {
  color: black;
}
.dialog_title {
  margin-top: 10px;
  text-align: center;
  font-size: 18px;
  color: #000000;
  line-height: 25px;
  font-family: AlibabaPuHuiTiM;
}
.dialog_layout {
  background: #F8F8F8;
  border-radius: 12px;
  border: 1px solid #EDEDED;
  margin-bottom: 15px;
  padding: 15px 25px;
}
.dialog-list {
  margin-top: -20px;
  height:550px;
  overflow:auto
}
.dialog-item {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 3px 0;
}
.dialog-item-text {
  font-size: 14px;
  color: #000000;
  line-height: 24px;
  text-align: left;
  font-family: AlibabaPuHuiTiR;
}
.dialog-success {
  color: #2DBD74;
}
.dialog-fail {
  color: #EC7B2D;
}
.dialog-pending {
  color: #4782D2;
}
.dialog-btn {
  margin: 5px 0 5px -5px;
  cursor: pointer;
  width: 110px;
  height: 36px;
  background: #000000 !important;
  border: 0;
  border-radius: 20px;
  font-size: 14px;
  color: #FFFFFF !important;
  font-family: AlibabaPuHuiTiR;
}
.dialog-btn:hover {
  background: #00000090 !important;
}
.dialog-btn:disabled {
  background: #CCCCCC !important;
  cursor: not-allowed;
}

.empty-text {
  margin-top: -20px;
  height:300px;
  text-align: center;
  font-size: 16px;
  color: #999999;
  line-height: 300px;
  font-family: AlibabaPuHuiTiM;
}
</style>
