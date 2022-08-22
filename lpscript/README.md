# L2Bridge Scripts for Liquidate Providers

## Introduction
LP script for L2bridge is a handy tool for liquidity providers to run a background service or execute a one-time task to automatically fulfill the following requirements:
-  Observe source L2 for user deposits and take orders (a.k.a. claim) on destination L2
-  Synchronize/relay hash heads from destination L2 chain to source L2 chain
-  Withdraw funds from source L2 contract
-  Cost control through gas price configurations
-  Show status of pending claims and ETH and token balances of current LP account

## Installation
Node 16 and yarn 1.22 or above are required.
```sh
# download
git clone git@github.com:QuarkChain/L2Bridge.git
# go to lpscripts
cd lpscripts
# install
yarn
```
## How Does It Work
The L2Bridge enables users to transfer ERC20 tokens across Ethereum L2 networks without interacting with L1. LPs on the other side, transfer funds to the user on the target L2, and withdraw their funds later from the source L2 contract later after the transfer data hash is passed from target L2 to source L2, which proves their claims.  
The more detailed procedure is like the following:  
Step 1: user deposits funds on source L2, most likely through the frontend.  
Step 2: LP detects user deposit, and calls the L2Bridge contract to claim the order on destination L2, which updates the hash head of all transfer data so far.  
Step 3: Anyone can call the L2Bridge contract to declare the new hash head, to inform the L1 contract of the new state update.  
Step 4: After the challenge period, an L1 transaction needs to be called to trigger the L1 contract to update its state.  
Step 5: In the case of the hash head passing from L1 to Arbitrum, a setChainHashInL2 function should be called separately on L1. For Optimism, it will be done automatically.  
Step 6: When the hash head is available on source L2, LPs can withdraw their funds back on source L2 by providing reward data as hash proofs.

### About deployments.json
You will need a contract configuration file named [deployments.json](https://github.com/QuarkChain/L2Bridge/blob/main/contract/deployments.json) to run the script. It is structured in the following way:
```  
root
    |-1(L1 chain Id)
        |-tokens[]
            |-token1
                |-name
                |-L1_address
                |-Optimism_address
                |-Arbitrum_address
            |-token2
            ...
        |-O2A (fund direction)
            |-bridge(l1 contract address)
            |-bridgeSrc(source L2 contract address, which is Optimism for O2A)
            |-bridgeDest(destination L2 contract address, which is Arbitrum for O2A)
        |-A2O
        ...
    |-5
    ...
```

### Supported L2 Networks
The project currently supports 2 L2 networks in both directions, which are Arbitrum and Optimism. 
The direction can be understood as the fund flow direction from the user's point of view. For example, `O2A` means the source chain is Optimism and destination chain is Arbitrum, and `A2O` means the opposite direction.

### Supported Tokens
In the part of the `L1 chain id` / `tokens` in `deployments.json` file, you can add/remove tokens that are supported by the script.
### Configurations
You will need to create a .env file with the following configurations:
```sh
# the private key of the LP account (without 0x)
# it is highly suggested to use a *different* LP account for each script running instance
PRIVATE_KEY="2a84c..."
# location of the deployments.json.
DEPLOYMENTS="../../contract/deployments.json"
# L1 RPC URL, e.g. an Infura link end with your api key
RPC_L1="https://mainnet.infura.io/v3/${INFURA_API_KEY}"
# Arbitrum RPC URL
RPC_AB="https://arbitrum-mainnet.infura.io/v3/${INFURA_API_KEY}"
# Optimism RPC URL
RPC_OP="https://mainnet.optimism.io/"
# the threshold of LP fee to take orders in USD
MIN_LP_FEE=10
# query interval of user deposit event in seconds
CLAIM_INTERVAL=30
# time interval in seconds for the sync service to run. 
# Automatically sync every claimed hash head if SYNC_INTERVAL=0.
# Or you can choose not to run sync service at all by setting SYNC_INTERVAL=-1. Please be noted that this may save some gas but at the risk of the expiration of orders.
SYNC_INTERVAL=600
# the buffer in seconds to consider if time is enough to claim an order, in addition to the challenge period 
CLAIM_TIME_BUFFER=68400
# L1 chain ID
L1_CHAIN_ID=1
# direction
DIRECTION=O2A
# the maximum fee per gas (Gwei) that is willing to pay for L1 transaction (inclusive of base fee and max priority fee)
# use the default value if set to 0
MAX_FEE_PER_GAS_L1=0
# the maximum fee per gas (Gwei) that willing to pay for Arbitrum transaction except for claim (inclusive of base fee and max priority fee)
# use the default value if set to 0
MAX_FEE_PER_GAS_AB=0
# the gas price upper limit (Gwei) that willing to pay for Optimism transaction except for claim
# use the default gas price if set to 0
GAS_PRICE_OP=0
# the max priority fee or tip (Gwei) to bid for a claim on Arbitrum 
# use the default value if set to -1
MAX_PRIORITY_FEE_AB_CLAIM=-1
# an integer stands for a multiplier of gas price to bid for a claim on Optimism. e.g. 120 means 1.2x of default gas price
GAS_PRICE_MULTIPLIER_OP_CLAIM=100
```
### Usages
Usually, you can run the service in the default mode, which starts a service to watch user deposits on the source chain and claim.   
Working with `SYNC_INTERVAL` config, you can also sync claimed hash head, as well as withdraw funds on the destination chain as soon as sync finishes.  
The script will start listening to users' deposit events on the latest block at the first start, or continue with the last processed block at a restart.
```sh
yarn start
```
You can also specify a block number manually to start with. 
```sh
yarn start 348221
```
You can check the status of all of the orders you claimed but have not withdrawn yet.
```sh
yarn status
```
Check status with a specified count.
```sh
yarn status 6
```
A one-time task to relay the last claim's hash and withdraw all your claims before and include that count.
```sh
yarn sync
```
You can also choose to synchronize and withdraw a specified order in favor. For example,  the following command executes a one-time task to sync the proof of order 6 and withdraw all claimed funds before it (include 6).
```sh
yarn sync 6
```
## FAQs
### Why should I be concerned about the relay of the claimed hash head?
When an LP claimed an order on the destination L2, a hash head is generated. This hash head needs to be relayed to the source target L2 to prove that this order is claimed by the LP so that it can be withdrawn. 
### What happens if the order is expired?
If the users' deposit is expired, they can refund their token from the source L2 contract. The risk is if the order has been taken on destination L2 but the claim hash has not relayed to source L2, the LP will lose his money. 
### What should I do to prevent my order from expired?
First of all, you can choose to take those orders with a validity period long enough. When users deposit, the contract requires an expiration of longer than 8 days. Considering the challenge period is 7 days, when you claim an order that will be expired in 8 days, there is at most 24 hours buffer to handle the hash relay and withdraw transactions, etc. `CLAIM_TIME_BUFFER` in .env allows you to place a safe margin in addition to the challenge period before claiming an order.  
Most importantly, you should start the procedure of relaying the hash head early enough after claiming. One choice is to sync each order automatically as soon as claimed. `SYNC_INTERVAL` plays an important role here. See [more](#how-should-i-manage-the-sync-service) for more detail.       
Finally, you'd better keep an eye on the status of your pending orders, and take extra actions if needed. The `yarn status` command is what you need here.
### How should I manage the sync service?
The sync service will relay each claim hash head from the destination chain to the source chain till withdrawal, which is a total of 3 to 4 transactions including the withdraw transaction on the source chain.
You can control the frequency of the declare operation which starts the sync procedure by `SYNC_INTERVAL`.   
If `SYNC_INTERVAL` is set to -1, you will not sync your claims actively. There is a possibility that you can still get your funds back while other LPs do sync and withdrawals and this could be the most gas-efficient strategy.  
 **Warning:** If nobody does so, there could be a risk your claim will be expired.   
 As an option, you can sync manually with `yarn sync` to sync only the latest count later in a proper time.   
If `SYNC_INTERVAL` is set to 0, each claim will be declared immediately after a claim. This mode will work if there are not many orders, or if the orders are spread widely in time. However, if orders are taken much frequently, the sync/withdraw transactions for each order are not only gas consuming, but unnecessary. See [here](#can-i-withdraw-multiple-orders-in-one-transaction) for more detail.   
Ideally, you can set `SYNC_INTERVAL` to a proper value in seconds so that the sync service only declares the latest claim periodically, and you can balance your gas cost and expiration risk. 
### Can I withdraw multiple orders in one transaction?
Yes. For example, if the hash of claim count 6 is relayed to the source chain, while the hash of count 4 is still on the way and count 3 has already been withdrawn, the contract can be called to withdraw all funds of claims from 4 to 6.   
In the script implementation, once a claim hash relay is done, a withdraw transaction will be sent for the corresponding claim count, and all relay procedures with a smaller count number will be canceled if the withdrawal is successful.
### How much can I earn for each order?
There are a lot of variables to consider in this question.  
On one hand, LP income comes from each order's LP fee. In each user deposit order, there is a ramp-up fee for LP with an upper bound, giving LPs time to wait for a comfortable bid price, like an English auction mechanism. By the `MIN_LP_FEE` config in .env file, you can set a lower bound of LP fee acceptable in USD.  
On the other hand, you should control the operation cost as described [here](#how-can-i-control-gas-costs).  
Moreover, there are other considerations like operation cost to run the service, the risks caused by token price volatility, opportunity costs due to liquidity turnover, etc., which are out of the scope of this tool.
### How can I control gas costs?
As described [here](#how-should-i-manage-the-sync-service), you can choose sync strategy to control costs caused by unnecessary sync transactions.  
To control gas costs on the transaction level, you can use `MAX_FEE_PER_GAS_L1` (for L1), `MAX_FEE_PER_GAS_AB` (for Arbitrum), or `GAS_PRICE_OP` (for Optimism) to limit the gas price for transactions other than taking orders (a.k.a claim). If the real-time gas price is higher, the transactions will be pending for later confirmation.   
Note that if maxFeePerGas is lower than maxPriorityFeePerGas the transaction will fail, so it will be ignored by the script.  
**Warning:** If there were network congestion and the claim hashes are not relayed to source L2 in time due to low gas price, there are risks that orders would be expired. 
### How can I get a better chance to win the claim bid?
To get a better chance to win the claim bid, you can use the max priority fee or gas price multiplier configuration to boost the gas price used for the claim transaction:  
- For Arbitrum as the destination chain (O2A), use `MAX_PRIORITY_FEE_AB_CLAIM` to specify the max priority fee (tip) in Gwei
- For Optimism as the destination chain (A2O), use `GAS_PRICE_MULTIPLIER_OP_CLAIM` which will multiply the real-time gas price.

### How can I run 2 instances in different directions?
You can download the code in two different locations, make copies of .env file for each instance, and configure it in different directions. Make sure to use different `PRIVATE_KEY` as LP account to avoid nonce confliction.