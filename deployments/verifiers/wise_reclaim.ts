import { BigNumber } from "ethers";
import { Currency } from "../../utils/protocolUtils";
import { hashProviderParams } from "@zkp2p/reclaim-witness-sdk";

export const getWiseReclaimProviderHashes = async (length: number) => {
  return [
    '0x14f029619c364094675f9b308d389a6edccde6f43c099e30c212a2ec219d9646'
  ]
}

export const WISE_APPCLIP_PROVIDER_HASHES = [
  ""
]

export const WISE_RECLAIM_CURRENCIES: any = [
  Currency.USD,
  Currency.EUR,
  Currency.GBP,
  Currency.SGD,
  Currency.AUD,
  Currency.NZD,
  Currency.CAD
];

export const WISE_RECLAIM_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds

export const WISE_RECLAIM_FEE_SHARE = BigNumber.from(0);  // 0% of sustainability fee
