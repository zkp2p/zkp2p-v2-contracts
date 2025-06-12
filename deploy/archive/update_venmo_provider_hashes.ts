import "module-alias/register";

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

import {
  MULTI_SIG,
} from "../../deployments/parameters";
import {
  getDeployedContractAddress,
  removeProviderHash,
  addProviderHash
} from "../../deployments/helpers";
import {
  getVenmoReclaimProviderHashes,
  VENMO_APPCLIP_PROVIDER_HASHES,
  VENMO_OLD_EXTENSION_PROVIDER_HASHES
} from "../../deployments/verifiers/venmo_reclaim";


// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;

  const venmoVerifierAddress = getDeployedContractAddress(network, "VenmoReclaimVerifier");


  const venmoVerifier = await ethers.getContractAt("VenmoReclaimVerifier", venmoVerifierAddress);

  // Remove old extension provider hashes
  for (const providerHash of VENMO_OLD_EXTENSION_PROVIDER_HASHES) {
    await removeProviderHash(hre, venmoVerifier, providerHash);
  }

  // Add new appclip provider hashes
  const venmoNewExtensionProviderHashes = await getVenmoReclaimProviderHashes(10);
  for (const providerHash of venmoNewExtensionProviderHashes) {
    await addProviderHash(hre, venmoVerifier, providerHash);
  }

  console.log("Venmo provider hashes updated...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  return true; // always skip
};

export default func;
