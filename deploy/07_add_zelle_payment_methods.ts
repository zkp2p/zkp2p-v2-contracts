import "module-alias/register";

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

import {
  MULTI_SIG,
} from "../deployments/parameters";
import {
  getDeployedContractAddress,
  addPaymentMethodToRegistry,
  addPaymentMethodToUnifiedVerifier,
  savePaymentMethodSnapshot
} from "../deployments/helpers";
import {
  ZELLE_CITI_PROVIDER_CONFIG,
  ZELLE_CHASE_PROVIDER_CONFIG,
  ZELLE_BOFA_PROVIDER_CONFIG,
} from "../deployments/verifiers/zelle";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;

  const paymentVerifierRegistryAddress = getDeployedContractAddress(network, "PaymentVerifierRegistry");
  const unifiedVerifierAddress = getDeployedContractAddress(network, "UnifiedPaymentVerifier");

  // Get contract instances
  const paymentVerifierRegistryContract = await ethers.getContractAt(
    "PaymentVerifierRegistry", paymentVerifierRegistryAddress
  );
  const unifiedVerifierContract = await ethers.getContractAt(
    "UnifiedPaymentVerifier", unifiedVerifierAddress
  );

  // Add Zelle Citi
  await addPaymentMethodToRegistry(
    hre,
    paymentVerifierRegistryContract,
    ZELLE_CITI_PROVIDER_CONFIG.paymentMethodHash,
    unifiedVerifierAddress,
    ZELLE_CITI_PROVIDER_CONFIG.currencies
  );
  console.log("Zelle Citi added to payment method registry...");

  const citiProviderHashes = ZELLE_CITI_PROVIDER_CONFIG.providerHashes;
  console.log("zelle citi extension provider hashes", citiProviderHashes);

  // Snapshot provider hashes
  savePaymentMethodSnapshot(network, 'zelle-citi', {
    paymentMethodHash: ZELLE_CITI_PROVIDER_CONFIG.paymentMethodHash,
    providerHashes: citiProviderHashes,
    currencies: ZELLE_CITI_PROVIDER_CONFIG.currencies,
    timestampBuffer: ZELLE_CITI_PROVIDER_CONFIG.timestampBuffer
  });

  await addPaymentMethodToUnifiedVerifier(
    hre,
    unifiedVerifierContract,
    ZELLE_CITI_PROVIDER_CONFIG.paymentMethodHash,
    ZELLE_CITI_PROVIDER_CONFIG.timestampBuffer,
    citiProviderHashes
  );
  console.log("Zelle Citi added to unified verifier...");

  // Add Zelle Chase
  await addPaymentMethodToRegistry(
    hre,
    paymentVerifierRegistryContract,
    ZELLE_CHASE_PROVIDER_CONFIG.paymentMethodHash,
    unifiedVerifierAddress,
    ZELLE_CHASE_PROVIDER_CONFIG.currencies
  );
  console.log("Zelle Chase added to payment method registry...");

  const chaseProviderHashes = ZELLE_CHASE_PROVIDER_CONFIG.providerHashes;
  console.log("zelle chase extension provider hashes", chaseProviderHashes);

  // Snapshot provider hashes
  savePaymentMethodSnapshot(network, 'zelle-chase', {
    paymentMethodHash: ZELLE_CHASE_PROVIDER_CONFIG.paymentMethodHash,
    providerHashes: chaseProviderHashes,
    currencies: ZELLE_CHASE_PROVIDER_CONFIG.currencies,
    timestampBuffer: ZELLE_CHASE_PROVIDER_CONFIG.timestampBuffer
  });

  await addPaymentMethodToUnifiedVerifier(
    hre,
    unifiedVerifierContract,
    ZELLE_CHASE_PROVIDER_CONFIG.paymentMethodHash,
    ZELLE_CHASE_PROVIDER_CONFIG.timestampBuffer,
    chaseProviderHashes
  );
  console.log("Zelle Chase added to unified verifier...");

  // Add Zelle Bank of America
  await addPaymentMethodToRegistry(
    hre,
    paymentVerifierRegistryContract,
    ZELLE_BOFA_PROVIDER_CONFIG.paymentMethodHash,
    unifiedVerifierAddress,
    ZELLE_BOFA_PROVIDER_CONFIG.currencies
  );
  console.log("Zelle BofA added to payment method registry...");

  const boaProviderHashes = ZELLE_BOFA_PROVIDER_CONFIG.providerHashes;
  console.log("zelle bofa extension provider hashes", boaProviderHashes);

  // Snapshot provider hashes
  savePaymentMethodSnapshot(network, 'zelle-bofa', {
    paymentMethodHash: ZELLE_BOFA_PROVIDER_CONFIG.paymentMethodHash,
    providerHashes: boaProviderHashes,
    currencies: ZELLE_BOFA_PROVIDER_CONFIG.currencies,
    timestampBuffer: ZELLE_BOFA_PROVIDER_CONFIG.timestampBuffer
  });

  await addPaymentMethodToUnifiedVerifier(
    hre,
    unifiedVerifierContract,
    ZELLE_BOFA_PROVIDER_CONFIG.paymentMethodHash,
    ZELLE_BOFA_PROVIDER_CONFIG.timestampBuffer,
    boaProviderHashes
  );
  console.log("Zelle BofA added to unified verifier...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  return false;
};

export default func;
