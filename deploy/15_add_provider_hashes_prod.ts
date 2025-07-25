import "module-alias/register";

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

import {
  MULTI_SIG,
} from "../deployments/parameters";
import {
  getDeployedContractAddress,
  batchProviderHashOperations,
  ProviderHashOperation
} from "../deployments/helpers";
import {
  getVenmoReclaimProviderHashes,
  VENMO_APPCLIP_PROVIDER_HASHES
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

/**
 * Deployment script to add new provider hashes to verifiers on base network.
 * This script only performs ADD operations for new provider hashes.
 * For removing old provider hashes, use 16_remove_provider_hashes_prod.ts
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();

  // This script only runs on base network
  if (network !== 'base') {
    console.log(`Skipping deployment on ${network} - this script only runs on base network`);
    return;
  }

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;

  console.log(`[SAFE] Running provider hash additions on base network with multisig: ${multiSig}`);

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

  // Collect all ADD operations for batch processing
  const operations: ProviderHashOperation[] = [];

  // Venmo - Add new extension provider hashes
  console.log("Collecting Venmo provider hash ADD operations...");
  const venmoNewExtensionProviderHashes = await getVenmoReclaimProviderHashes(10);
  for (const providerHash of venmoNewExtensionProviderHashes) {
    operations.push({ contract: venmoVerifier, providerHash, operation: 'add' });
  }

  // Revolut - Add new extension provider hashes
  console.log("Collecting Revolut provider hash ADD operations...");
  const revolutNewExtensionProviderHashes = await getRevolutReclaimProviderHashes(20);
  for (const providerHash of revolutNewExtensionProviderHashes) {
    operations.push({ contract: revolutVerifier, providerHash, operation: 'add' });
  }

  // Cashapp - Add new extension provider hashes
  console.log("Collecting Cashapp provider hash ADD operations...");
  const cashappNewExtensionProviderHashes = await getCashappReclaimProviderHashes(15);
  for (const providerHash of cashappNewExtensionProviderHashes) {
    operations.push({ contract: cashappVerifier, providerHash, operation: 'add' });
  }

  // Wise - Add new extension provider hashes
  console.log("Collecting Wise provider hash ADD operations...");
  const wiseNewExtensionProviderHashes = await getWiseReclaimProviderHashes(1);
  for (const providerHash of wiseNewExtensionProviderHashes) {
    operations.push({ contract: wiseVerifier, providerHash, operation: 'add' });
  }

  // Mercado Pago - Add new extension provider hashes
  console.log("Collecting Mercado Pago provider hash ADD operations...");
  const mercadoNewExtensionProviderHashes = await getMercadoReclaimProviderHashes(1);
  for (const providerHash of mercadoNewExtensionProviderHashes) {
    operations.push({ contract: mercadoVerifier, providerHash, operation: 'add' });
  }

  // Zelle Citi - Add new extension provider hashes
  console.log("Collecting Zelle Citi provider hash ADD operations...");
  const zelleCitiNewExtensionProviderHashes = await getZelleCitiReclaimProviderHashes(20);
  for (const providerHash of zelleCitiNewExtensionProviderHashes) {
    operations.push({ contract: zelleCitiVerifier, providerHash, operation: 'add' });
  }

  // Zelle BoA - Add new extension provider hashes
  console.log("Collecting Zelle BoA provider hash ADD operations...");
  const zelleBoANewExtensionProviderHashes = await getZelleBoAReclaimProviderHashes(10);
  for (const providerHash of zelleBoANewExtensionProviderHashes) {
    operations.push({ contract: zelleBoAVerifier, providerHash, operation: 'add' });
  }

  // Zelle Chase - Add new extension provider hashes
  console.log("Collecting Zelle Chase provider hash ADD operations...");
  const zelleChaseNewExtensionProviderHashes = await getZelleChaseReclaimProviderHashes(10);
  for (const providerHash of zelleChaseNewExtensionProviderHashes) {
    operations.push({ contract: zelleChaseVerifier, providerHash, operation: 'add' });
  }

  console.log(`Total ADD operations collected: ${operations.length}`);

  // Execute batch operations
  await batchProviderHashOperations(hre, operations);

  console.log("Provider hash batch addition complete. Transaction proposed to Safe.");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  const network = hre.deployments.getNetworkName();
  // Skip on all networks except base
  return network !== 'base';
};

func.tags = ['AddProviderHashesProd'];

export default func;