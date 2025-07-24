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
  getRevolutReclaimProviderHashes,
  REVOLUT_OLD_EXTENSION_PROVIDER_HASHES
} from "../deployments/verifiers/revolut_reclaim";
import {
  getCashappReclaimProviderHashes,
  CASHAPP_OLD_EXTENSION_PROVIDER_HASHES
} from "../deployments/verifiers/cashapp_reclaim";
import {
  getWiseReclaimProviderHashes,
  WISE_OLD_EXTENSION_PROVIDER_HASHES
} from "../deployments/verifiers/wise_reclaim";
import {
  getMercadoReclaimProviderHashes,
  MERCADO_OLD_EXTENSION_PROVIDER_HASHES
} from "../deployments/verifiers/mercado_pago_reclaim";
import {
  getZelleCitiReclaimProviderHashes,
  getZelleBoAReclaimProviderHashes,
  getZelleChaseReclaimProviderHashes,
  ZELLE_CHASE_OLD_EXTENSION_PROVIDER_HASHES,
  ZELLE_CITI_OLD_EXTENSION_PROVIDER_HASHES,
  ZELLE_BOA_OLD_EXTENSION_PROVIDER_HASHES,
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

  // Remove old extension provider hashes
  for (const providerHash of VENMO_OLD_EXTENSION_PROVIDER_HASHES) {
    await removeProviderHash(hre, venmoVerifier, providerHash);
    // add delay
    await new Promise(resolve => setTimeout(resolve, 4000));
  }

  const venmoNewExtensionProviderHashes = await getVenmoReclaimProviderHashes(10);
  for (const providerHash of venmoNewExtensionProviderHashes) {
    await addProviderHash(hre, venmoVerifier, providerHash);
    // add delay
    await new Promise(resolve => setTimeout(resolve, 4000));
  }

  for (const providerHash of REVOLUT_OLD_EXTENSION_PROVIDER_HASHES) {
    await removeProviderHash(hre, revolutVerifier, providerHash);
    // add delay
    await new Promise(resolve => setTimeout(resolve, 4000));
  }

  const revolutNewExtensionProviderHashes = await getRevolutReclaimProviderHashes(20);
  for (const providerHash of revolutNewExtensionProviderHashes) {
    await addProviderHash(hre, revolutVerifier, providerHash);
    // add delay
    await new Promise(resolve => setTimeout(resolve, 4000));
  }

  for (const providerHash of CASHAPP_OLD_EXTENSION_PROVIDER_HASHES) {
    await removeProviderHash(hre, cashappVerifier, providerHash);
    // add delay
    await new Promise(resolve => setTimeout(resolve, 4000));
  }

  const cashappNewExtensionProviderHashes = await getCashappReclaimProviderHashes(15);
  for (const providerHash of cashappNewExtensionProviderHashes) {
    await addProviderHash(hre, cashappVerifier, providerHash);
    // add delay
    await new Promise(resolve => setTimeout(resolve, 4000));
  }

  for (const providerHash of WISE_OLD_EXTENSION_PROVIDER_HASHES) {
    await removeProviderHash(hre, wiseVerifier, providerHash);
    // add delay
    await new Promise(resolve => setTimeout(resolve, 4000));
  }

  const wiseNewExtensionProviderHashes = await getWiseReclaimProviderHashes(1);
  for (const providerHash of wiseNewExtensionProviderHashes) {
    await addProviderHash(hre, wiseVerifier, providerHash);
    // add delay
    await new Promise(resolve => setTimeout(resolve, 4000));
  }

  for (const providerHash of MERCADO_OLD_EXTENSION_PROVIDER_HASHES) {
    await removeProviderHash(hre, mercadoVerifier, providerHash);
    // add delay
    await new Promise(resolve => setTimeout(resolve, 4000));
  }

  const mercadoNewExtensionProviderHashes = await getMercadoReclaimProviderHashes(1);
  for (const providerHash of mercadoNewExtensionProviderHashes) {
    await addProviderHash(hre, mercadoVerifier, providerHash);
    // add delay
    await new Promise(resolve => setTimeout(resolve, 4000));
  }

  for (const providerHash of ZELLE_CITI_OLD_EXTENSION_PROVIDER_HASHES) {
    await removeProviderHash(hre, zelleCitiVerifier, providerHash);
    // add delay
    await new Promise(resolve => setTimeout(resolve, 4000));
  }

  const zelleCitiNewExtensionProviderHashes = await getZelleCitiReclaimProviderHashes(20);
  for (const providerHash of zelleCitiNewExtensionProviderHashes) {
    await addProviderHash(hre, zelleCitiVerifier, providerHash);
    // add delay
    await new Promise(resolve => setTimeout(resolve, 4000));
  }

  for (const providerHash of ZELLE_BOA_OLD_EXTENSION_PROVIDER_HASHES) {
    await removeProviderHash(hre, zelleBoAVerifier, providerHash);
    // add delay
    await new Promise(resolve => setTimeout(resolve, 4000));
  }

  const zelleBoANewExtensionProviderHashes = await getZelleBoAReclaimProviderHashes(10);
  for (const providerHash of zelleBoANewExtensionProviderHashes) {
    await addProviderHash(hre, zelleBoAVerifier, providerHash);
    // add delay
    await new Promise(resolve => setTimeout(resolve, 4000));
  }

  for (const providerHash of ZELLE_CHASE_OLD_EXTENSION_PROVIDER_HASHES) {
    await removeProviderHash(hre, zelleChaseVerifier, providerHash);
    // add delay
    await new Promise(resolve => setTimeout(resolve, 4000));
  }

  const zelleChaseNewExtensionProviderHashes = await getZelleChaseReclaimProviderHashes(10);
  for (const providerHash of zelleChaseNewExtensionProviderHashes) {
    await addProviderHash(hre, zelleChaseVerifier, providerHash);
    // add delay
    await new Promise(resolve => setTimeout(resolve, 4000));
  }

  console.log("All provider hashes updated...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  return false;
};

export default func;
