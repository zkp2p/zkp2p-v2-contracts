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
  chainId: string
) => {
  const messageHash = ethers.utils.solidityKeccak256(
    ["uint256", "uint256", "address", "address", "bytes32", "uint256"],
    [depositId, amount, to, verifier, fiatCurrency, chainId]
  );
  return await gatingService.wallet.signMessage(ethers.utils.arrayify(messageHash));
}