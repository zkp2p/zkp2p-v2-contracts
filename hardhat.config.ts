import * as dotenv from 'dotenv';

import '@typechain/hardhat'
import 'solidity-coverage'
import '@nomiclabs/hardhat-ethers'
import 'hardhat-deploy';
import '@nomiclabs/hardhat-etherscan';
import '@nomicfoundation/hardhat-chai-matchers'

import { HardhatUserConfig } from "hardhat/config";

import "./tasks/releaseFundsToPayer";
import "./tasks/accountIntent";
import "./tasks/blockNumber";
import "./tasks/createDeposit";
import "./tasks/signalIntent";
import "./tasks/tokenBalance";
import "./tasks/chainId";
import "./tasks/logCurrencies";

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
  networks: {
    hardhat: {
      initialDate: "2024-01-20 01:15:15 PM",
      allowBlocksWithSameTimestamp: true,
    },
    localhost: {
      allowBlocksWithSameTimestamp: true,
    },
    base_staging: {
      url: "https://developer-access-mainnet.base.org",
      // @ts-ignore
      accounts: [
        `0x${process.env.BASE_DEPLOY_PRIVATE_KEY}`,
      ],
      verify: {
        etherscan: {
          apiUrl: "https://api.basescan.org/",
          apiKey: process.env.BASESCAN_API_KEY
        }
      },
    },
    sepolia: {
      url: "https://sepolia.infura.io/v3/" + process.env.INFURA_TOKEN,
      // @ts-ignore
      accounts: [
        `0x${process.env.TESTNET_DEPLOY_PRIVATE_KEY}`,
      ],
      verify: {
        etherscan: {
          apiKey: process.env.ETHERSCAN_KEY
        }
      },
    },
    goerli: {
      url: "https://goerli.infura.io/v3/" + process.env.INFURA_TOKEN,
      // @ts-ignore
      accounts: [
        `0x${process.env.TESTNET_DEPLOY_PRIVATE_KEY}`,
      ],
      verify: {
        etherscan: {
          apiKey: process.env.ETHERSCAN_KEY
        }
      },
    },
    base: {
      url: "https://developer-access-mainnet.base.org",
      // @ts-ignore
      accounts: [
        `0x${process.env.BASE_DEPLOY_PRIVATE_KEY}`,
      ],
      verify: {
        etherscan: {
          apiUrl: "https://api.basescan.org/",
          apiKey: process.env.BASESCAN_API_KEY
        }
      },
    },
  },
  // @ts-ignore
  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
  },
};

export default config;
