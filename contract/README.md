# L2 Bridge Contracts

Run `yarn` to install the dependencies, use `yarn` + following commands + [network] to run the scripts:

```
    "compile": "hardhat compile",
    "test": "hardhat test",
    "deployl1": "hardhat run scripts/deployl1.js",
    "deployl2": "hardhat run scripts/deployl2.js",
    "deployTokens": "hardhat run scripts/deployTokens.js",
    "verify": "hardhat run scripts/verify.js",
    "prettier:check": "prettier-check contracts/**/*.sol",
    "prettier:fix": "prettier --write contracts/**/*.sol test/**/*.js scripts/**/*.js"
```

Remember to copy the `.env.template` to a new `.env` file and add your own keys.