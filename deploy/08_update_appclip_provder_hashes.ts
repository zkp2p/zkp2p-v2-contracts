import "module-alias/register";

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

import {
  MULTI_SIG,
} from "../deployments/parameters";
import {
  getDeployedContractAddress,
  removeProviderHash,
  addProviderHash
} from "../deployments/helpers";
import {
  REVOLUT_OLD_APPCLIP_PROVIDER_HASHES,
  REVOLUT_APPCLIP_PROVIDER_HASHES
} from "../deployments/verifiers/revolut_reclaim";
import {
  VENMO_APPCLIP_PROVIDER_HASHES,
  VENMO_OLD_APPCLIP_PROVIDER_HASHES
} from "../deployments/verifiers/venmo_reclaim";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;

  const revolutVerifierAddress = getDeployedContractAddress(network, "RevolutReclaimVerifier");
  const venmoVerifierAddress = getDeployedContractAddress(network, "VenmoReclaimVerifier");

  const revolutVerifier = await ethers.getContractAt("RevolutReclaimVerifier", revolutVerifierAddress);
  const venmoVerifier = await ethers.getContractAt("VenmoReclaimVerifier", venmoVerifierAddress);

  // Remove old Venmo provider hashes
  for (const providerHash of VENMO_OLD_APPCLIP_PROVIDER_HASHES) {
    await removeProviderHash(hre, venmoVerifier, providerHash);
  }

  // Add new Venmo provider hashes
  for (const providerHash of VENMO_APPCLIP_PROVIDER_HASHES) {
    await addProviderHash(hre, venmoVerifier, providerHash);
  }

  // Remove old Revolut provider hashes
  for (const providerHash of REVOLUT_OLD_APPCLIP_PROVIDER_HASHES) {
    await removeProviderHash(hre, revolutVerifier, providerHash);
  }

  // Add new Revolut provider hashes
  for (const providerHash of REVOLUT_APPCLIP_PROVIDER_HASHES) {
    await addProviderHash(hre, revolutVerifier, providerHash);
  }

  console.log("All appclip provider hashes are updated...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  return false;  // always run
};

export default func;
