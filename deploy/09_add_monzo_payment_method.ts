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
import { MONZO_PROVIDER_CONFIG } from "../deployments/verifiers/monzo";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;

  const paymentVerifierRegistryAddress = getDeployedContractAddress(network, "PaymentVerifierRegistry");
  const unifiedVerifierAddress = getDeployedContractAddress(network, "UnifiedPaymentVerifier");

  // Add Monzo to payment method registry
  const paymentVerifierRegistryContract = await ethers.getContractAt(
    "PaymentVerifierRegistry", paymentVerifierRegistryAddress
  );
  await addPaymentMethodToRegistry(
    hre,
    paymentVerifierRegistryContract,
    MONZO_PROVIDER_CONFIG.paymentMethodHash,
    unifiedVerifierAddress,
    MONZO_PROVIDER_CONFIG.currencies
  );
  console.log("Monzo added to payment method registry...");

  // Monzo returns single transaction details
  const providerHashes = MONZO_PROVIDER_CONFIG.providerHashes;
  console.log("monzo extension provider hashes", providerHashes);

  // Snapshot provider hashes
  savePaymentMethodSnapshot(network, 'monzo', {
    paymentMethodHash: MONZO_PROVIDER_CONFIG.paymentMethodHash,
    providerHashes,
    currencies: MONZO_PROVIDER_CONFIG.currencies,
    timestampBuffer: MONZO_PROVIDER_CONFIG.timestampBuffer
  });

  // Add Monzo to unified verifier
  const unifiedVerifierContract = await ethers.getContractAt(
    "UnifiedPaymentVerifier", unifiedVerifierAddress
  );
  await addPaymentMethodToUnifiedVerifier(
    hre,
    unifiedVerifierContract,
    MONZO_PROVIDER_CONFIG.paymentMethodHash,
    MONZO_PROVIDER_CONFIG.timestampBuffer,
    providerHashes
  );
  console.log("Monzo added to unified verifier...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  return false;
};

export default func;
