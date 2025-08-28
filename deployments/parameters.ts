import "module-alias/register";
import { ONE_DAY_IN_SECONDS, THREE_MINUTES_IN_SECONDS, ZERO, ONE_HOUR_IN_SECONDS } from "../utils/constants";
import { ether, usdc } from "../utils/common/units";

export const PARTIAL_MANUAL_RELEASE_DELAY: any = {
  "localhost": ONE_HOUR_IN_SECONDS.mul(12), // 12 hours
  "base": ONE_HOUR_IN_SECONDS.mul(12), // 12 hours
  "base_staging": ONE_HOUR_IN_SECONDS.mul(12), // 12 hours
  "base_sepolia": ONE_HOUR_IN_SECONDS.mul(12), // 12 hours
};

export const INTENT_EXPIRATION_PERIOD: any = {
  "localhost": ONE_DAY_IN_SECONDS,
  "base": ONE_DAY_IN_SECONDS,
  "base_staging": ONE_HOUR_IN_SECONDS,
  "base_sepolia": ONE_HOUR_IN_SECONDS,
};

export const PROTOCOL_TAKER_FEE: any = {
  "localhost": ether(.001),
  "base": ZERO,
  "base_staging": ZERO,
  "base_sepolia": ZERO,
};

export const PROTOCOL_MAKER_FEE: any = {
  "localhost": ether(.001),
  "base": ZERO,
  "base_staging": ZERO,
  "base_sepolia": ZERO,
}

export const PROTOCOL_TAKER_FEE_RECIPIENT: any = {
  "localhost": "",
  "base": "0x0bC26FF515411396DD588Abd6Ef6846E04470227",
  "base_staging": "",
  "base_sepolia": "",
};

export const PROTOCOL_MAKER_FEE_RECIPIENT: any = {
  "localhost": "",
  "base": "0x0bC26FF515411396DD588Abd6Ef6846E04470227",
  "base_staging": "",
  "base_sepolia": "",
};

export const DUST_THRESHOLD: any = {
  "localhost": usdc(0.1),
  "base": usdc(0.1),
  "base_staging": usdc(0.1),
  "base_sepolia": usdc(0.1),
};

export const MAX_INTENTS_PER_DEPOSIT: any = {
  "localhost": 100,
  "base": 200,
  "base_staging": 200,
  "base_sepolia": 200,
};

export const MULTI_SIG: any = {
  "localhost": "",
  "base": "0x0bC26FF515411396DD588Abd6Ef6846E04470227",
  "base_staging": "",
  "base_sepolia": "",
};

export const USDC: any = {
  "base": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "base_staging": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
};

// For Goerli and localhost
export const USDC_MINT_AMOUNT = usdc(1000000);
export const USDC_RECIPIENT = "0x84e113087C97Cd80eA9D78983D4B8Ff61ECa1929";

export const WITNESS_ADDRESS: any = {
  "localhost": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "base": "",
  "base_staging": "",
  "base_sepolia": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
};

export const ZKTLS_ATTESTOR_ADDRESS: any = {
  "localhost": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "base": "",
  "base_staging": "",
  "base_sepolia": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
};