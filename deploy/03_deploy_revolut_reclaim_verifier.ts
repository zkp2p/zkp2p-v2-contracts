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
import {
  getRevolutReclaimProviderHashes,
  REVOLUT_RECLAIM_CURRENCIES,
  REVOLUT_RECLAIM_TIMESTAMP_BUFFER,
  REVOLUT_RECLAIM_FEE_SHARE,
} from "../deployments/verifiers/revolut_reclaim";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments;
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;

  const escrowAddress = getDeployedContractAddress(network, "Escrow");
  const nullifierRegistryAddress = getDeployedContractAddress(network, "NullifierRegistry");


  // Revolut returns 20 transactions at a time
  const hashes = await getRevolutReclaimProviderHashes(20);
  const revolutVerifier = await deploy("RevolutReclaimVerifier", {
    from: deployer,
    args: [
      escrowAddress,
      nullifierRegistryAddress,
      REVOLUT_RECLAIM_TIMESTAMP_BUFFER,
      REVOLUT_RECLAIM_CURRENCIES,
      hashes,
    ],
  });
  console.log("RevolutReclaimVerifier deployed at", revolutVerifier.address);

  const nullifierRegistryContract = await ethers.getContractAt("NullifierRegistry", nullifierRegistryAddress);
  await addWritePermission(hre, nullifierRegistryContract, revolutVerifier.address);

  console.log("NullifierRegistry permissions added...");

  const escrowContract = await ethers.getContractAt("Escrow", escrowAddress);
  await addWhitelistedPaymentVerifier(hre, escrowContract, revolutVerifier.address, REVOLUT_RECLAIM_FEE_SHARE); // No fee share for mock

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
