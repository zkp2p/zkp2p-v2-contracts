import "module-alias/register";

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

import {
  MULTI_SIG,
} from "../deployments/parameters";
import {
  addWritePermission,
  addWhitelistedPaymentVerifier,
  getDeployedContractAddress,
  setNewOwner
} from "../deployments/helpers";
import {
  getCashappReclaimProviderHashes,
  CASHAPP_RECLAIM_CURRENCIES,
  CASHAPP_RECLAIM_TIMESTAMP_BUFFER,
} from "../deployments/verifiers/cashapp_reclaim";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments;
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;

  const escrowAddress = getDeployedContractAddress(network, "Escrow");
  const nullifierRegistryAddress = getDeployedContractAddress(network, "NullifierRegistry");
  const paymentVerifierRegistryAddress = getDeployedContractAddress(network, "PaymentVerifierRegistry");

  // Cashapp page size is 15
  const providerHashes = await getCashappReclaimProviderHashes(15);
  console.log("cashapp extension provider hashes", providerHashes);

  const cashappVerifier = await deploy("CashappReclaimVerifier", {
    from: deployer,
    args: [
      escrowAddress,
      nullifierRegistryAddress,
      CASHAPP_RECLAIM_TIMESTAMP_BUFFER,
      CASHAPP_RECLAIM_CURRENCIES,
      providerHashes,
    ],
  });
  console.log("CashappReclaimVerifier deployed at", cashappVerifier.address);

  const nullifierRegistryContract = await ethers.getContractAt("NullifierRegistry", nullifierRegistryAddress);
  await addWritePermission(hre, nullifierRegistryContract, cashappVerifier.address);

  console.log("NullifierRegistry permissions added...");

  // Add CashappReclaimVerifier to registry
  const paymentVerifierRegistryContract = await ethers.getContractAt(
    "PaymentVerifierRegistry", paymentVerifierRegistryAddress
  );
  await addWhitelistedPaymentVerifier(
    hre,
    paymentVerifierRegistryContract,
    cashappVerifier.address
  );

  console.log("CashappReclaimVerifier added to whitelisted payment verifiers...");

  console.log("Transferring ownership of contracts...");
  await setNewOwner(
    hre,
    await ethers.getContractAt("CashappReclaimVerifier", cashappVerifier.address),
    multiSig
  );

  console.log("Deploy finished...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  const network = hre.network.name;
  if (network != "localhost") {
    try { getDeployedContractAddress(hre.network.name, "CashappReclaimVerifier") } catch (e) { return false; }
    return true;
  }
  return false;
};

export default func;
