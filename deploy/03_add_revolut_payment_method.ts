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
import { REVOLUT_PROVIDER_CONFIG } from "../deployments/verifiers/revolut";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;

  const paymentVerifierRegistryAddress = getDeployedContractAddress(network, "PaymentVerifierRegistry");
  const unifiedVerifierAddress = getDeployedContractAddress(network, "UnifiedPaymentVerifier");

  // Add Revolut to payment method registry
  const paymentVerifierRegistryContract = await ethers.getContractAt(
    "PaymentVerifierRegistry", paymentVerifierRegistryAddress
  );
  await addPaymentMethodToRegistry(
    hre,
    paymentVerifierRegistryContract,
    REVOLUT_PROVIDER_CONFIG.paymentMethodHash,
    unifiedVerifierAddress,
    REVOLUT_PROVIDER_CONFIG.currencies
  );
  console.log("Revolut added to payment method registry...");

  // Revolut returns 20 transactions at a time
  const providerHashes = REVOLUT_PROVIDER_CONFIG.providerHashes;
  console.log("revolut extension provider hashes", providerHashes);

  // Snapshot provider hashes
  savePaymentMethodSnapshot(network, 'revolut', {
    paymentMethodHash: REVOLUT_PROVIDER_CONFIG.paymentMethodHash,
    providerHashes,
    currencies: REVOLUT_PROVIDER_CONFIG.currencies,
    timestampBuffer: REVOLUT_PROVIDER_CONFIG.timestampBuffer
  });

  // Add Revolut to unified verifier
  const unifiedVerifierContract = await ethers.getContractAt(
    "UnifiedPaymentVerifier", unifiedVerifierAddress
  );
  await addPaymentMethodToUnifiedVerifier(
    hre,
    unifiedVerifierContract,
    REVOLUT_PROVIDER_CONFIG.paymentMethodHash,
    REVOLUT_PROVIDER_CONFIG.timestampBuffer,
    providerHashes
  );
  console.log("Revolut added to unified verifier...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  return false;
};

export default func;
