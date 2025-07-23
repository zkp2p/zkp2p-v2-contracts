import * as dotenv from 'dotenv';

import '@typechain/hardhat'
import 'solidity-coverage'
import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy';
import '@nomiclabs/hardhat-etherscan';
import '@nomicfoundation/hardhat-chai-matchers'
import 'hardhat-gas-reporter';

import { HardhatUserConfig } from "hardhat/config";

import "./tasks/releaseFundsToPayer";
import "./tasks/accountIntent";
import "./tasks/blockNumber";
import "./tasks/createDeposit";
import "./tasks/signalIntent";
import "./tasks/tokenBalance";
import "./tasks/chainId";
import "./tasks/logCurrencies";
import "./tasks/etherscanVerifyWithDelay";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.18",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          }
        },
      },
    ],
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_KEY || "",
      base: process.env.BASESCAN_API_KEY || "",
      baseSepolia: process.env.BASESCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org"
        }
      },
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org"
        }
      }
    ]
  },
  networks: {
    hardhat: {
      initialDate: "2024-01-20 01:15:15 PM",
      allowBlocksWithSameTimestamp: true,
    },
    localhost: {
      allowBlocksWithSameTimestamp: true,
    },
    base_staging: {
      url: "https://base-mainnet.g.alchemy.com/v2/" + process.env.ALCHEMY_API_KEY,
      // @ts-ignore
      accounts: [
        `0x${process.env.BASE_DEPLOY_PRIVATE_KEY}`,
      ],
    },
    sepolia: {
      url: "https://eth-sepolia.g.alchemy.com/v2/" + process.env.ALCHEMY_API_KEY,
      // @ts-ignore
      accounts: [
        `0x${process.env.TESTNET_DEPLOY_PRIVATE_KEY}`,
      ],
      gasPrice: 100000000000, // 300 gwei
      gas: 8000000, // 8 million gas limit
    },
    base_sepolia: {
      url: "https://sepolia.base.org",
      // @ts-ignore
      accounts: [
        `0x${process.env.TESTNET_DEPLOY_PRIVATE_KEY}`,
      ],
      gasPrice: 5000000000, // 5 gwei
      gas: 8000000, // 8 million gas limit
    },
    goerli: {
      url: "https://goerli.infura.io/v3/" + process.env.INFURA_TOKEN,
      // @ts-ignore
      accounts: [
        `0x${process.env.TESTNET_DEPLOY_PRIVATE_KEY}`,
      ],
    },
    base: {
      url: "https://base-mainnet.g.alchemy.com/v2/" + process.env.ALCHEMY_API_KEY,
      // @ts-ignore
      accounts: [
        `0x${process.env.BASE_DEPLOY_PRIVATE_KEY}`,
      ],
    },
  },
  // @ts-ignore
  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
  },
  gasReporter: {
    enabled: false,
    reportPureAndViewMethods: true,
    showMethodSig: true,
  }
};

export default config;
