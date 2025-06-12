import "module-alias/register";
import { ONE_DAY_IN_SECONDS, THREE_MINUTES_IN_SECONDS, ZERO } from "../utils/constants";
import { ether, usdc } from "../utils/common/units";

export const INTENT_EXPIRATION_PERIOD: any = {
  "localhost": ONE_DAY_IN_SECONDS,
  "goerli": THREE_MINUTES_IN_SECONDS,
  "sepolia": THREE_MINUTES_IN_SECONDS,
  "base": ONE_DAY_IN_SECONDS,
  "base_staging": THREE_MINUTES_IN_SECONDS,
};

export const PROTOCOL_FEE: any = {
  "localhost": ether(.001),
  "goerli": ether(.001),
  "sepolia": ether(.001),
  "base": ZERO,
  "base_staging": ZERO
};

export const PROTOCOL_FEE_RECIPIENT: any = {
  "localhost": "",
  "goerli": "",
  "sepolia": "",
  "base": "0x0bC26FF515411396DD588Abd6Ef6846E04470227",
  "base_staging": "",
};

export const MULTI_SIG: any = {
  "localhost": "",
  "goerli": "",
  "sepolia": "",
  "base": "0x0bC26FF515411396DD588Abd6Ef6846E04470227",
  "base_staging": "",
};

export const USDC: any = {
  "base": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "base_staging": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

// For Goerli and localhost
export const USDC_MINT_AMOUNT = usdc(1000000);
export const USDC_RECIPIENT = "0x84e113087C97Cd80eA9D78983D4B8Ff61ECa1929";
