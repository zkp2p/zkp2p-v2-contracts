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
import {
  getRevolutReclaimProviderHashes,
  REVOLUT_RECLAIM_CURRENCIES,
  REVOLUT_RECLAIM_TIMESTAMP_BUFFER
} from "../deployments/verifiers/revolut_reclaim";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments;
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;

  const escrowAddress = getDeployedContractAddress(network, "Escrow");
  const paymentVerifierRegistryAddress = getDeployedContractAddress(network, "PaymentVerifierRegistry");
  const nullifierRegistryAddress = getDeployedContractAddress(network, "NullifierRegistry");


  // Revolut returns 20 transactions at a time
  const extensionProviderHashes = await getRevolutReclaimProviderHashes(20);
  console.log("revolut extension provider hashes", extensionProviderHashes);
  const providerHashes = extensionProviderHashes;
  const revolutVerifier = await deploy("RevolutReclaimVerifier", {
    from: deployer,
    args: [
      escrowAddress,
      nullifierRegistryAddress,
      REVOLUT_RECLAIM_TIMESTAMP_BUFFER,
      REVOLUT_RECLAIM_CURRENCIES,
      providerHashes,
    ],
  });
  console.log("RevolutReclaimVerifier deployed at", revolutVerifier.address);

  const nullifierRegistryContract = await ethers.getContractAt("NullifierRegistry", nullifierRegistryAddress);
  await addWritePermission(hre, nullifierRegistryContract, revolutVerifier.address);

  console.log("NullifierRegistry permissions added...");

  // Add RevolutReclaimVerifier to registry
  const paymentVerifierRegistryContract = await ethers.getContractAt(
    "PaymentVerifierRegistry", paymentVerifierRegistryAddress
  );
  await addWhitelistedPaymentVerifier(
    hre,
    paymentVerifierRegistryContract,
    revolutVerifier.address
  );

  console.log("RevolutReclaimVerifier added to whitelisted payment verifiers...");

  console.log("Transferring ownership of contracts...");
  await setNewOwner(
    hre,
    await ethers.getContractAt("RevolutReclaimVerifier", revolutVerifier.address),
    multiSig
  );

  console.log("Deploy finished...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  const network = hre.network.name;
  if (network != "localhost") {
    try { getDeployedContractAddress(hre.network.name, "RevolutReclaimVerifier") } catch (e) { return false; }
    return true;
  }
  return false;
};

export default func;
