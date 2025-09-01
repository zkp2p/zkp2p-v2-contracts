import { ethers } from "ethers";
import { BigNumber } from "ethers";
import { AbiCoder } from "ethers/lib/utils";

const CIRCOM_FIELD = BigNumber.from("21888242871839275222246405745257275088548364400416034343698204186575808495617");

export const getKeccak256Hash = (value: string): string => {
  // Convert the string to UTF-8 bytes
  const bytes = ethers.utils.toUtf8Bytes(value);

  // Compute keccak256 hash of the packed bytes
  return ethers.utils.keccak256(bytes);
}

export const Currency = {
  AED: getKeccak256Hash("AED"),
  ARS: getKeccak256Hash("ARS"),
  AUD: getKeccak256Hash("AUD"),
  CAD: getKeccak256Hash("CAD"),
  CHF: getKeccak256Hash("CHF"),
  CNY: getKeccak256Hash("CNY"),
  EUR: getKeccak256Hash("EUR"),
  GBP: getKeccak256Hash("GBP"),
  HKD: getKeccak256Hash("HKD"),
  IDR: getKeccak256Hash("IDR"),
  ILS: getKeccak256Hash("ILS"),
  JPY: getKeccak256Hash("JPY"),
  KES: getKeccak256Hash("KES"),
  MXN: getKeccak256Hash("MXN"),
  MYR: getKeccak256Hash("MYR"),
  NZD: getKeccak256Hash("NZD"),
  PLN: getKeccak256Hash("PLN"),
  SAR: getKeccak256Hash("SAR"),
  SGD: getKeccak256Hash("SGD"),
  THB: getKeccak256Hash("THB"),
  TRY: getKeccak256Hash("TRY"),
  USD: getKeccak256Hash("USD"),
  VND: getKeccak256Hash("VND"),
  ZAR: getKeccak256Hash("ZAR"),
} as const;


export const getCurrencyCodeFromHash = (hash: string): string => {
  return Object.keys(Currency).find(key => Currency[key as keyof typeof Currency] === hash) || "";
}

export const calculateIntentHash = (
  orchestrator: string,
  intentCounter: BigNumber | number,
): string => {

  const intermediateHash = ethers.utils.solidityKeccak256(
    ["address", "uint256"],
    [orchestrator, intentCounter]
  );

  return ethers.utils.hexZeroPad(BigNumber.from(intermediateHash).mod(CIRCOM_FIELD).toHexString(), 32);
};
