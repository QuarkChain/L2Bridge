# QuarkChain Bridge Web App

![banner](./src/images/bridge_logo.png)

The **QuarkChain Bridge** is a web frontend that allows users to easily send Terra assets across supported blockchains
via their respective bridges.

Users can connect their wallets to the QuarkChain Bridge web app through a browser plugin for Chromium-based web
browsers, as shown below:

| Blockchain | Supported Wallets                                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| QuarkChain |  [MetaMask](https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn?hl=en)|
| BSC        | [Binance Chain Wallet](https://chrome.google.com/webstore/detail/binance-chain-wallet/fhbohimaelbohpjbbldcngcnapndodjp?hl=en) or [MetaMask](https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn?hl=en)     |

## Instructions

1. Install dependencies

```bash
$ npm install
```

2. Run Bridge

```bash
$ npm start
```

3. Build and Deploy

- Install `awscli`
- Run `aws configure` to add access
- Use `aws s3 ls` to list buckets
- Change the bucket name in '.env' and export
- Run `npm run bd` to build and deploy

## License

This software is licensed under the Apache 2.0 license. Read more about it [here](./LICENSE).

© 2021 Terra Bridge Web App
