import "module-alias/register";
import { BigNumber } from "ethers";
import { ONE_DAY_IN_SECONDS, THREE_MINUTES_IN_SECONDS, ZERO } from "../utils/constants";
import { ether, usdc } from "../utils/common/units";

export const TIMESTAMP_BUFFER = {
  "venmo_reclaim": BigNumber.from(30)
};

export const INTENT_EXPIRATION_PERIOD: any = {
  "localhost": ONE_DAY_IN_SECONDS,
  "goerli": THREE_MINUTES_IN_SECONDS,
  "sepolia": THREE_MINUTES_IN_SECONDS,
  "base": ONE_DAY_IN_SECONDS,
  "base_staging": THREE_MINUTES_IN_SECONDS,
};

export const SUSTAINABILITY_FEE: any = {
  "localhost": ether(.001),
  "goerli": ether(.001),
  "sepolia": ether(.001),
  "base": ZERO,
  "base_staging": ZERO
};

export const SUSTAINABILITY_FEE_RECIPIENT: any = {
  "localhost": "",
  "goerli": "",
  "sepolia": "",
  "base": "0x0bC26FF515411396DD588Abd6Ef6846E04470227",
  "base_staging": "0xdd93E0f5fC32c86A568d87Cb4f08598f55E980F3",
};

export const MULTI_SIG: any = {
  "localhost": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "goerli": "",
  "sepolia": "",
  "base": "0x0bC26FF515411396DD588Abd6Ef6846E04470227",
  "base_staging": "0xdd93E0f5fC32c86A568d87Cb4f08598f55E980F3",
};

export const USDC: any = {
  "base": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "base_staging": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

// For Goerli and localhost
export const USDC_MINT_AMOUNT = usdc(1000000);
export const USDC_RECIPIENT = "0x1d2033DC6720e3eCC14aBB8C2349C7ED77E831ad";
