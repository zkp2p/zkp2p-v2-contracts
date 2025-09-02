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
  ZELLE_RECLAIM_CURRENCIES,
  ZELLE_RECLAIM_TIMESTAMP_BUFFER,
  getZelleCitiReclaimProviderHashes,
  getZelleBoAReclaimProviderHashes,
  getZelleChaseReclaimProviderHashes,
  ZELLE_CITI_PAYMENT_METHOD_HASH,
  ZELLE_CHASE_PAYMENT_METHOD_HASH,
  ZELLE_BOFA_PAYMENT_METHOD_HASH,
} from "../deployments/verifiers/zelle_reclaim";

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
    ZELLE_CITI_PAYMENT_METHOD_HASH,
    unifiedVerifierAddress,
    ZELLE_RECLAIM_CURRENCIES
  );
  console.log("Zelle Citi added to payment method registry...");

  const citiProviderHashes = await getZelleCitiReclaimProviderHashes(20);
  console.log("zelle citi extension provider hashes", citiProviderHashes);

  // Snapshot provider hashes
  savePaymentMethodSnapshot(network, 'zelle-citi', {
    paymentMethodHash: ZELLE_CITI_PAYMENT_METHOD_HASH,
    providerHashes: citiProviderHashes,
    currencies: ZELLE_RECLAIM_CURRENCIES,
    timestampBuffer: ZELLE_RECLAIM_TIMESTAMP_BUFFER.citi
  });

  await addPaymentMethodToUnifiedVerifier(
    hre,
    unifiedVerifierContract,
    ZELLE_CITI_PAYMENT_METHOD_HASH,
    ZELLE_RECLAIM_TIMESTAMP_BUFFER['citi'],
    citiProviderHashes
  );
  console.log("Zelle Citi added to unified verifier...");

  // Add Zelle Chase
  await addPaymentMethodToRegistry(
    hre,
    paymentVerifierRegistryContract,
    ZELLE_CHASE_PAYMENT_METHOD_HASH,
    unifiedVerifierAddress,
    ZELLE_RECLAIM_CURRENCIES
  );
  console.log("Zelle Chase added to payment method registry...");

  const chaseProviderHashes = await getZelleChaseReclaimProviderHashes(10);
  console.log("zelle chase extension provider hashes", chaseProviderHashes);

  // Snapshot provider hashes
  savePaymentMethodSnapshot(network, 'zelle-chase', {
    paymentMethodHash: ZELLE_CHASE_PAYMENT_METHOD_HASH,
    providerHashes: chaseProviderHashes,
    currencies: ZELLE_RECLAIM_CURRENCIES,
    timestampBuffer: ZELLE_RECLAIM_TIMESTAMP_BUFFER.chase
  });

  await addPaymentMethodToUnifiedVerifier(
    hre,
    unifiedVerifierContract,
    ZELLE_CHASE_PAYMENT_METHOD_HASH,
    ZELLE_RECLAIM_TIMESTAMP_BUFFER['chase'],
    chaseProviderHashes
  );
  console.log("Zelle Chase added to unified verifier...");

  // Add Zelle Bank of America
  await addPaymentMethodToRegistry(
    hre,
    paymentVerifierRegistryContract,
    ZELLE_BOFA_PAYMENT_METHOD_HASH,
    unifiedVerifierAddress,
    ZELLE_RECLAIM_CURRENCIES
  );
  console.log("Zelle BofA added to payment method registry...");

  const boaProviderHashes = await getZelleBoAReclaimProviderHashes(10);
  console.log("zelle bofa extension provider hashes", boaProviderHashes);

  // Snapshot provider hashes
  savePaymentMethodSnapshot(network, 'zelle-bofa', {
    paymentMethodHash: ZELLE_BOFA_PAYMENT_METHOD_HASH,
    providerHashes: boaProviderHashes,
    currencies: ZELLE_RECLAIM_CURRENCIES,
    timestampBuffer: ZELLE_RECLAIM_TIMESTAMP_BUFFER.bofa
  });

  await addPaymentMethodToUnifiedVerifier(
    hre,
    unifiedVerifierContract,
    ZELLE_BOFA_PAYMENT_METHOD_HASH,
    ZELLE_RECLAIM_TIMESTAMP_BUFFER['bofa'],
    boaProviderHashes
  );
  console.log("Zelle BofA added to unified verifier...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  return false;
};

export default func;