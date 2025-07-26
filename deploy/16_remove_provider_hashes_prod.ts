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
  VENMO_OLD_EXTENSION_PROVIDER_HASHES
} from "../deployments/verifiers/venmo_reclaim";
import {
  REVOLUT_OLD_EXTENSION_PROVIDER_HASHES
} from "../deployments/verifiers/revolut_reclaim";
import {
  CASHAPP_OLD_EXTENSION_PROVIDER_HASHES
} from "../deployments/verifiers/cashapp_reclaim";
import {
  WISE_OLD_EXTENSION_PROVIDER_HASHES
} from "../deployments/verifiers/wise_reclaim";
import {
  MERCADO_OLD_EXTENSION_PROVIDER_HASHES
} from "../deployments/verifiers/mercado_pago_reclaim";
import {
  ZELLE_CHASE_OLD_EXTENSION_PROVIDER_HASHES,
  ZELLE_CITI_OLD_EXTENSION_PROVIDER_HASHES,
  ZELLE_BOA_OLD_EXTENSION_PROVIDER_HASHES,
} from "../deployments/verifiers/zelle_reclaim";
import { PAYPAL_OLD_EXTENSION_PROVIDER_HASHES } from "../deployments/verifiers/paypal_reclaim";
import { MONZO_OLD_EXTENSION_PROVIDER_HASHES } from "../deployments/verifiers/monzo_reclaim";

/**
 * Deployment script to remove old provider hashes from verifiers on base network.
 * This script only performs REMOVE operations for deprecated provider hashes.
 * 
 * IMPORTANT: This script should be run AFTER script 15_add_provider_hashes_prod.ts
 * to ensure new provider hashes are added before removing old ones. This prevents
 * any service interruption.
 * 
 * The removal of old provider hashes is typically done after:
 * 1. New provider hashes have been successfully added
 * 2. The system has been verified to work with new hashes
 * 3. There's confidence that old hashes are no longer needed
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

  console.log(`[SAFE] Running provider hash removals on base network with multisig: ${multiSig}`);

  const venmoVerifierAddress = getDeployedContractAddress(network, "VenmoReclaimVerifier");
  const revolutVerifierAddress = getDeployedContractAddress(network, "RevolutReclaimVerifier");
  const cashappVerifierAddress = getDeployedContractAddress(network, "CashappReclaimVerifier");
  const wiseVerifierAddress = getDeployedContractAddress(network, "WiseReclaimVerifier");
  const mercadoVerifierAddress = getDeployedContractAddress(network, "MercadoPagoReclaimVerifier");
  const zelleCitiVerifierAddress = getDeployedContractAddress(network, "ZelleCitiReclaimVerifier");
  const zelleBoAVerifierAddress = getDeployedContractAddress(network, "ZelleBoAReclaimVerifier");
  const zelleChaseVerifierAddress = getDeployedContractAddress(network, "ZelleChaseReclaimVerifier");
  const paypalVerifierAddress = getDeployedContractAddress(network, "PaypalReclaimVerifier");
  const monzoVerifierAddress = getDeployedContractAddress(network, "MonzoReclaimVerifier");

  const venmoVerifier = await ethers.getContractAt("VenmoReclaimVerifier", venmoVerifierAddress);
  const revolutVerifier = await ethers.getContractAt("RevolutReclaimVerifier", revolutVerifierAddress);
  const cashappVerifier = await ethers.getContractAt("CashappReclaimVerifier", cashappVerifierAddress);
  const wiseVerifier = await ethers.getContractAt("WiseReclaimVerifier", wiseVerifierAddress);
  const mercadoVerifier = await ethers.getContractAt("MercadoPagoReclaimVerifier", mercadoVerifierAddress);
  const zelleCitiVerifier = await ethers.getContractAt("ZelleCitiReclaimVerifier", zelleCitiVerifierAddress);
  const zelleBoAVerifier = await ethers.getContractAt("ZelleBoAReclaimVerifier", zelleBoAVerifierAddress);
  const zelleChaseVerifier = await ethers.getContractAt("ZelleChaseReclaimVerifier", zelleChaseVerifierAddress);
  const paypalVerifier = await ethers.getContractAt("PaypalReclaimVerifier", paypalVerifierAddress);
  const monzoVerifier = await ethers.getContractAt("MonzoReclaimVerifier", monzoVerifierAddress);

  // Collect all REMOVE operations for batch processing
  const operations: ProviderHashOperation[] = [];

  // Venmo - Remove old extension provider hashes
  console.log("Collecting Venmo provider hash REMOVE operations...");
  for (const providerHash of VENMO_OLD_EXTENSION_PROVIDER_HASHES) {
    operations.push({ contract: venmoVerifier, providerHash, operation: 'remove' });
  }

  // Revolut - Remove old extension provider hashes
  console.log("Collecting Revolut provider hash REMOVE operations...");
  for (const providerHash of REVOLUT_OLD_EXTENSION_PROVIDER_HASHES) {
    operations.push({ contract: revolutVerifier, providerHash, operation: 'remove' });
  }

  // Cashapp - Remove old extension provider hashes
  console.log("Collecting Cashapp provider hash REMOVE operations...");
  for (const providerHash of CASHAPP_OLD_EXTENSION_PROVIDER_HASHES) {
    operations.push({ contract: cashappVerifier, providerHash, operation: 'remove' });
  }

  // Wise - Remove old extension provider hashes
  console.log("Collecting Wise provider hash REMOVE operations...");
  for (const providerHash of WISE_OLD_EXTENSION_PROVIDER_HASHES) {
    operations.push({ contract: wiseVerifier, providerHash, operation: 'remove' });
  }

  // Mercado Pago - Remove old extension provider hashes
  console.log("Collecting Mercado Pago provider hash REMOVE operations...");
  for (const providerHash of MERCADO_OLD_EXTENSION_PROVIDER_HASHES) {
    operations.push({ contract: mercadoVerifier, providerHash, operation: 'remove' });
  }

  // Zelle Citi - Remove old extension provider hashes
  console.log("Collecting Zelle Citi provider hash REMOVE operations...");
  for (const providerHash of ZELLE_CITI_OLD_EXTENSION_PROVIDER_HASHES) {
    operations.push({ contract: zelleCitiVerifier, providerHash, operation: 'remove' });
  }

  // Zelle BoA - Remove old extension provider hashes
  console.log("Collecting Zelle BoA provider hash REMOVE operations...");
  for (const providerHash of ZELLE_BOA_OLD_EXTENSION_PROVIDER_HASHES) {
    operations.push({ contract: zelleBoAVerifier, providerHash, operation: 'remove' });
  }

  // Zelle Chase - Remove old extension provider hashes
  console.log("Collecting Zelle Chase provider hash REMOVE operations...");
  for (const providerHash of ZELLE_CHASE_OLD_EXTENSION_PROVIDER_HASHES) {
    operations.push({ contract: zelleChaseVerifier, providerHash, operation: 'remove' });
  }

  console.log(`Total REMOVE operations collected: ${operations.length}`);

  // Paypal - Remove old extension provider hashes
  console.log("Collecting Paypal provider hash REMOVE operations...");
  for (const providerHash of PAYPAL_OLD_EXTENSION_PROVIDER_HASHES) {
    operations.push({ contract: paypalVerifier, providerHash, operation: 'remove' });
  }

  // Monzo - Remove old extension provider hashes
  console.log("Collecting Monzo provider hash REMOVE operations...");
  for (const providerHash of MONZO_OLD_EXTENSION_PROVIDER_HASHES) {
    operations.push({ contract: monzoVerifier, providerHash, operation: 'remove' });
  }

  console.log(`Total REMOVE operations collected: ${operations.length}`);

  // Execute batch operations
  await batchProviderHashOperations(hre, operations);

  console.log("Provider hash batch removal complete. Transaction proposed to Safe.");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  const network = hre.deployments.getNetworkName();
  // Skip on all networks except base
  // return network !== 'base';
  return true;
};

func.tags = ['RemoveProviderHashesProd'];

export default func;