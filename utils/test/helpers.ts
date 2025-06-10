import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { Account } from "@utils/test/types";
import { Address } from "@utils/types";

export const generateGatingServiceSignature = async (
  gatingService: Account,
  depositId: BigNumber,
  amount: BigNumber,
  to: Address,
  verifier: Address,
  fiatCurrency: string,
  conversionRate: BigNumber,
  chainId: string
) => {
  const messageHash = ethers.utils.solidityKeccak256(
    ["uint256", "uint256", "address", "address", "bytes32", "uint256", "uint256"],
    [depositId, amount, to, verifier, fiatCurrency, conversionRate, chainId]
  );
  return await gatingService.wallet.signMessage(ethers.utils.arrayify(messageHash));
}

export const createSignalIntentParams = async (
  depositId: BigNumber,
  amount: BigNumber,
  to: Address,
  verifier: Address,
  fiatCurrency: string,
  conversionRate: BigNumber,
  referrer: Address = ethers.constants.AddressZero,
  referrerFee: BigNumber = BigNumber.from(0),
  gatingService: Account | null = null,
  chainId: string = "1",
  postIntentHook: Address = ethers.constants.AddressZero,
  data: string = "0x"
) => {
  let gatingServiceSignature = "0x";

  if (gatingService) {
    gatingServiceSignature = await generateGatingServiceSignature(
      gatingService,
      depositId,
      amount,
      to,
      verifier,
      fiatCurrency,
      conversionRate,
      chainId
    );
  }

  return {
    depositId,
    amount,
    to,
    verifier,
    fiatCurrency,
    conversionRate,
    referrer,
    referrerFee,
    gatingServiceSignature,
    postIntentHook,
    data
  };
}