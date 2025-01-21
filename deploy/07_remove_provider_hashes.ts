import "module-alias/register";

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

import {
  MULTI_SIG,
} from "../deployments/parameters";
import {
  getDeployedContractAddress,
  removeProviderHash
} from "../deployments/helpers";
import { CASHAPP_APPCLIP_PROVIDER_HASHES } from "../deployments/verifiers/cashapp_reclaim";
import { WISE_APPCLIP_PROVIDER_HASHES } from "../deployments/verifiers/wise_reclaim";


// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;

  const cashappVerifierAddress = getDeployedContractAddress(network, "CashappReclaimVerifier");
  const wiseVerifierAddress = getDeployedContractAddress(network, "WiseReclaimVerifier");


  const cashappVerifier = await ethers.getContractAt("CashappReclaimVerifier", cashappVerifierAddress);
  for (const providerHash of CASHAPP_APPCLIP_PROVIDER_HASHES) {
    await removeProviderHash(hre, cashappVerifier, providerHash);
  }


  const wiseVerifier = await ethers.getContractAt("WiseReclaimVerifier", wiseVerifierAddress);
  for (const providerHash of WISE_APPCLIP_PROVIDER_HASHES) {
    await removeProviderHash(hre, wiseVerifier, providerHash);
  }

  console.log("All empty appclip provider hashes are removed...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  return false;  // always run
};

export default func;
