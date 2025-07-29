import "module-alias/register";

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

import {
  MULTI_SIG,
} from "../deployments/parameters";
import {
  getDeployedContractAddress,
  addCurrency
} from "../deployments/helpers";
import { Currency } from "../utils/protocolUtils";

/**
 * Deployment script to add new currencies to Revolut and Wise verifiers on base network.
 * This script adds:
 * - Revolut: CNY, CZK, DKK, HUF, NOK, RON, SEK
 * - Wise: CZK, DKK, HUF, INR, NOK, PHP, RON, SEK
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;

  const revolutVerifierAddress = getDeployedContractAddress(network, "RevolutReclaimVerifier");
  const wiseVerifierAddress = getDeployedContractAddress(network, "WiseReclaimVerifier");

  const revolutVerifier = await ethers.getContractAt("RevolutReclaimVerifier", revolutVerifierAddress);
  const wiseVerifier = await ethers.getContractAt("WiseReclaimVerifier", wiseVerifierAddress);

  // New currencies to add to Revolut
  const newRevolutCurrencies = [
    Currency.CZK,
    Currency.CNY,
    Currency.DKK,
    Currency.HUF,
    Currency.NOK,
    Currency.RON,
    Currency.SEK,
  ];

  // New currencies to add to Wise
  const newWiseCurrencies = [
    Currency.CZK,
    Currency.DKK,
    Currency.HUF,
    Currency.INR,
    Currency.NOK,
    Currency.PHP,
    Currency.RON,
    Currency.SEK,
  ];

  console.log("Adding new currencies to Revolut verifier...");
  for (const currency of newRevolutCurrencies) {
    await addCurrency(hre, revolutVerifier, currency);
  }
  console.log(`Added ${newRevolutCurrencies.length} currencies to Revolut`);

  console.log("Adding new currencies to Wise verifier...");
  for (const currency of newWiseCurrencies) {
    await addCurrency(hre, wiseVerifier, currency);
  }
  console.log(`Added ${newWiseCurrencies.length} currencies to Wise`);

  console.log("Currency additions complete. Transaction proposed to Safe.");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  return false;
};

func.tags = ['AddNewCurrencies'];

export default func;