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
import { WISE_PROVIDER_CONFIG } from "../deployments/verifiers/wise";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;

  const paymentVerifierRegistryAddress = getDeployedContractAddress(network, "PaymentVerifierRegistry");
  const unifiedVerifierAddress = getDeployedContractAddress(network, "UnifiedPaymentVerifier");


  // Add Wise to payment method registry
  const paymentVerifierRegistryContract = await ethers.getContractAt(
    "PaymentVerifierRegistry", paymentVerifierRegistryAddress
  );
  await addPaymentMethodToRegistry(
    hre,
    paymentVerifierRegistryContract,
    WISE_PROVIDER_CONFIG.paymentMethodHash,
    unifiedVerifierAddress,
    WISE_PROVIDER_CONFIG.currencies
  );
  console.log("Wise added to payment method registry...");

  // Get Wise provider hashes
  const providerHashes = WISE_PROVIDER_CONFIG.providerHashes;
  console.log("wise extension provider hashes", providerHashes);

  // Snapshot provider hashes
  savePaymentMethodSnapshot(network, 'wise', {
    paymentMethodHash: WISE_PROVIDER_CONFIG.paymentMethodHash,
    providerHashes,
    currencies: WISE_PROVIDER_CONFIG.currencies,
    timestampBuffer: WISE_PROVIDER_CONFIG.timestampBuffer
  });

  // Add Wise to unified verifier
  const unifiedVerifierContract = await ethers.getContractAt(
    "UnifiedPaymentVerifier", unifiedVerifierAddress
  );
  await addPaymentMethodToUnifiedVerifier(
    hre,
    unifiedVerifierContract,
    WISE_PROVIDER_CONFIG.paymentMethodHash,
    WISE_PROVIDER_CONFIG.timestampBuffer,
    providerHashes
  );
  console.log("Wise added to unified verifier...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  return false;
};

export default func;
