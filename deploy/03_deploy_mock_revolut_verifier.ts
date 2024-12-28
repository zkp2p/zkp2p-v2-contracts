import "module-alias/register";

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, BigNumber } from "hardhat";
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

const REVOLUT_CURRENCIES = [
  Currency.EUR,
  Currency.GBP,
  Currency.SGD,
  Currency.USD
];

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments;
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;
  const paymentService = PaymentService.RevolutMock;

  const escrowAddress = getDeployedContractAddress(network, "Escrow");
  const nullifierRegistryAddress = getDeployedContractAddress(network, "NullifierRegistry");

  const revolutVerifier = await deploy("RevolutVerifierMock", {
    contract: "PaymentVerifierMock",
    from: deployer,
    args: [
      escrowAddress,
      nullifierRegistryAddress,
      "30",
      REVOLUT_CURRENCIES
    ],
  });
  console.log("RevolutVerifierMock deployed at", revolutVerifier.address);

  const nullifierRegistryContract = await ethers.getContractAt("NullifierRegistry", nullifierRegistryAddress);
  await addWritePermission(hre, nullifierRegistryContract, revolutVerifier.address);

  console.log("NullifierRegistry permissions added...");

  const escrowContract = await ethers.getContractAt("Escrow", escrowAddress);
  await addWhitelistedPaymentVerifier(hre, escrowContract, revolutVerifier.address, 0); // No fee share for mock

  console.log("RevolutVerifierMock added to whitelisted payment verifiers...");

  console.log("Transferring ownership of contracts...");
  await setNewOwner(
    hre,
    await ethers.getContractAt("PaymentVerifierMock", revolutVerifier.address),
    multiSig
  );

  console.log("Deploy finished...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  const network = hre.network.name;
  if (network != "localhost") {
    try { getDeployedContractAddress(hre.network.name, "RevolutVerifierMock") } catch (e) { return false; }
    return true;
  }
  return false;
};

export default func;
