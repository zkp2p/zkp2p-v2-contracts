import "module-alias/register";

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { Currency } from "../utils/protocolUtils";

import {
  MULTI_SIG,
} from "../deployments/parameters";
import {
  addWritePermission,
  addWhitelistedPaymentVerifier,
  getDeployedContractAddress,
  setNewOwner
} from "../deployments/helpers";
import { PaymentService } from "../utils/types";

const PAYPAL_CURRENCIES = [
  Currency.INR,
  Currency.ARS,
  Currency.GBP,
  Currency.USD,
  Currency.EUR
];

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments;
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;
  const paymentService = PaymentService.PayPalMock;

  const escrowAddress = getDeployedContractAddress(network, "Escrow");
  const nullifierRegistryAddress = getDeployedContractAddress(network, "NullifierRegistry");

  const paypalVerifier = await deploy("PayPalVerifierMock", {
    contract: "PaymentVerifierMock",
    from: deployer,
    args: [
      escrowAddress,
      nullifierRegistryAddress,
      "30",
      PAYPAL_CURRENCIES
    ],
  });
  console.log("PayPalVerifierMock deployed at", paypalVerifier.address);

  const nullifierRegistryContract = await ethers.getContractAt("NullifierRegistry", nullifierRegistryAddress);
  await addWritePermission(hre, nullifierRegistryContract, paypalVerifier.address);

  console.log("NullifierRegistry permissions added...");

  const escrowContract = await ethers.getContractAt("Escrow", escrowAddress);
  await addWhitelistedPaymentVerifier(hre, escrowContract, paypalVerifier.address, 0); // No fee share for mock

  console.log("PayPalVerifierMock added to whitelisted payment verifiers...");

  console.log("Transferring ownership of contracts...");
  await setNewOwner(
    hre,
    await ethers.getContractAt("PaymentVerifierMock", paypalVerifier.address),
    multiSig
  );

  console.log("Deploy finished...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  const network = hre.network.name;
  if (network != "localhost") {
    try { getDeployedContractAddress(hre.network.name, "PayPalVerifierMock") } catch (e) { return false; }
    return true;
  }
  return false;
};

export default func;
