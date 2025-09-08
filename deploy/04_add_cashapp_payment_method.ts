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
import { CASHAPP_PROVIDER_CONFIG } from "../deployments/verifiers/cashapp";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;

  const paymentVerifierRegistryAddress = getDeployedContractAddress(network, "PaymentVerifierRegistry");
  const unifiedVerifierAddress = getDeployedContractAddress(network, "UnifiedPaymentVerifier");


  // Add CashApp to payment method registry
  const paymentVerifierRegistryContract = await ethers.getContractAt(
    "PaymentVerifierRegistry", paymentVerifierRegistryAddress
  );
  await addPaymentMethodToRegistry(
    hre,
    paymentVerifierRegistryContract,
    CASHAPP_PROVIDER_CONFIG.paymentMethodHash,
    unifiedVerifierAddress,
    CASHAPP_PROVIDER_CONFIG.currencies
  );
  console.log("CashApp added to payment method registry...");

  // CashApp returns 20 activities at a time
  const providerHashes = CASHAPP_PROVIDER_CONFIG.providerHashes;
  console.log("cashapp extension provider hashes", providerHashes);

  // Snapshot provider hashes
  savePaymentMethodSnapshot(network, 'cashapp', {
    paymentMethodHash: CASHAPP_PROVIDER_CONFIG.paymentMethodHash,
    providerHashes,
    currencies: CASHAPP_PROVIDER_CONFIG.currencies,
    timestampBuffer: CASHAPP_PROVIDER_CONFIG.timestampBuffer
  });

  // Add CashApp to unified verifier
  const unifiedVerifierContract = await ethers.getContractAt(
    "UnifiedPaymentVerifier", unifiedVerifierAddress
  );
  await addPaymentMethodToUnifiedVerifier(
    hre,
    unifiedVerifierContract,
    CASHAPP_PROVIDER_CONFIG.paymentMethodHash,
    CASHAPP_PROVIDER_CONFIG.timestampBuffer,
    providerHashes
  );
  console.log("CashApp added to unified verifier...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  return false;
};

export default func;
