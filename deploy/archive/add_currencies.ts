import "module-alias/register";

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

import {
  MULTI_SIG,
} from "../../deployments/parameters";
import {
  getDeployedContractAddress,
  addCurrency
} from "../../deployments/helpers";
import { VENMO_RECLAIM_CURRENCIES } from "../../deployments/verifiers/venmo_reclaim";
import { CASHAPP_RECLAIM_CURRENCIES } from "../../deployments/verifiers/cashapp_reclaim";
import { REVOLUT_RECLAIM_CURRENCIES } from "../../deployments/verifiers/revolut_reclaim";
import { WISE_RECLAIM_CURRENCIES } from "../../deployments/verifiers/wise_reclaim";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;

  const cashappVerifierAddress = getDeployedContractAddress(network, "CashappReclaimVerifier");
  const revolutVerifierAddress = getDeployedContractAddress(network, "RevolutReclaimVerifier");
  const wiseVerifierAddress = getDeployedContractAddress(network, "WiseReclaimVerifier");


  const cashappVerifier = await ethers.getContractAt("CashappReclaimVerifier", cashappVerifierAddress);
  for (const currency of CASHAPP_RECLAIM_CURRENCIES) {
    await addCurrency(hre, cashappVerifier, currency);
  }


  const revolutVerifier = await ethers.getContractAt("RevolutReclaimVerifier", revolutVerifierAddress);
  for (const currency of REVOLUT_RECLAIM_CURRENCIES) {
    await addCurrency(hre, revolutVerifier, currency);
  }


  const wiseVerifier = await ethers.getContractAt("WiseReclaimVerifier", wiseVerifierAddress);
  for (const currency of WISE_RECLAIM_CURRENCIES) {
    await addCurrency(hre, wiseVerifier, currency);
  }

  console.log("All currencies are added...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  return true;  // always skip
};

export default func;
