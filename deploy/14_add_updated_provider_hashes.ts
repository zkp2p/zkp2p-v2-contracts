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
  getVenmoReclaimProviderHashes,
  VENMO_APPCLIP_PROVIDER_HASHES,
  VENMO_OLD_EXTENSION_PROVIDER_HASHES
} from "../deployments/verifiers/venmo_reclaim";
import {
  getRevolutReclaimProviderHashes
} from "../deployments/verifiers/revolut_reclaim";
import {
  getCashappReclaimProviderHashes
} from "../deployments/verifiers/cashapp_reclaim";
import {
  getWiseReclaimProviderHashes
} from "../deployments/verifiers/wise_reclaim";
import {
  getMercadoReclaimProviderHashes
} from "../deployments/verifiers/mercado_pago_reclaim";
import {
  getZelleCitiReclaimProviderHashes,
  getZelleBoAReclaimProviderHashes,
  getZelleChaseReclaimProviderHashes
} from "../deployments/verifiers/zelle_reclaim";


// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;

  const venmoVerifierAddress = getDeployedContractAddress(network, "VenmoReclaimVerifier");
  const revolutVerifierAddress = getDeployedContractAddress(network, "RevolutReclaimVerifier");
  const cashappVerifierAddress = getDeployedContractAddress(network, "CashappReclaimVerifier");
  const wiseVerifierAddress = getDeployedContractAddress(network, "WiseReclaimVerifier");
  const mercadoVerifierAddress = getDeployedContractAddress(network, "MercadoPagoReclaimVerifier");
  const zelleCitiVerifierAddress = getDeployedContractAddress(network, "ZelleCitiReclaimVerifier");
  const zelleBoAVerifierAddress = getDeployedContractAddress(network, "ZelleBoAReclaimVerifier");
  const zelleChaseVerifierAddress = getDeployedContractAddress(network, "ZelleChaseReclaimVerifier");

  const venmoVerifier = await ethers.getContractAt("VenmoReclaimVerifier", venmoVerifierAddress);
  const revolutVerifier = await ethers.getContractAt("RevolutReclaimVerifier", revolutVerifierAddress);
  const cashappVerifier = await ethers.getContractAt("CashappReclaimVerifier", cashappVerifierAddress);
  const wiseVerifier = await ethers.getContractAt("WiseReclaimVerifier", wiseVerifierAddress);
  const mercadoVerifier = await ethers.getContractAt("MercadoPagoReclaimVerifier", mercadoVerifierAddress);
  const zelleCitiVerifier = await ethers.getContractAt("ZelleCitiReclaimVerifier", zelleCitiVerifierAddress);
  const zelleBoAVerifier = await ethers.getContractAt("ZelleBoAReclaimVerifier", zelleBoAVerifierAddress);
  const zelleChaseVerifier = await ethers.getContractAt("ZelleChaseReclaimVerifier", zelleChaseVerifierAddress);

  // TODO: Remove old extension provider hashes for all verifiers

  const venmoNewExtensionProviderHashes = await getVenmoReclaimProviderHashes(10);
  for (const providerHash of venmoNewExtensionProviderHashes) {
    await addProviderHash(hre, venmoVerifier, providerHash);
    // add delay
    // await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const revolutNewExtensionProviderHashes = await getRevolutReclaimProviderHashes(20);
  for (const providerHash of revolutNewExtensionProviderHashes) {
    await addProviderHash(hre, revolutVerifier, providerHash);
    // await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const cashappNewExtensionProviderHashes = await getCashappReclaimProviderHashes(15);
  for (const providerHash of cashappNewExtensionProviderHashes) {
    await addProviderHash(hre, cashappVerifier, providerHash);
    // await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const wiseNewExtensionProviderHashes = await getWiseReclaimProviderHashes(1);
  for (const providerHash of wiseNewExtensionProviderHashes) {
    await addProviderHash(hre, wiseVerifier, providerHash);
    // await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const mercadoNewExtensionProviderHashes = await getMercadoReclaimProviderHashes(1);
  for (const providerHash of mercadoNewExtensionProviderHashes) {
    await addProviderHash(hre, mercadoVerifier, providerHash);
    // await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const zelleCitiNewExtensionProviderHashes = await getZelleCitiReclaimProviderHashes(20);
  for (const providerHash of zelleCitiNewExtensionProviderHashes) {
    await addProviderHash(hre, zelleCitiVerifier, providerHash);
    // await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const zelleBoANewExtensionProviderHashes = await getZelleBoAReclaimProviderHashes(10);
  for (const providerHash of zelleBoANewExtensionProviderHashes) {
    await addProviderHash(hre, zelleBoAVerifier, providerHash);
    // await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const zelleChaseNewExtensionProviderHashes = await getZelleChaseReclaimProviderHashes(10);
  for (const providerHash of zelleChaseNewExtensionProviderHashes) {
    await addProviderHash(hre, zelleChaseVerifier, providerHash);
    // await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log("All provider hashes updated...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  return false;
};

export default func;
