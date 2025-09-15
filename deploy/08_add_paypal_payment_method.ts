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
import { PAYPAL_PROVIDER_CONFIG } from "../deployments/verifiers/paypal";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;

  const paymentVerifierRegistryAddress = getDeployedContractAddress(network, "PaymentVerifierRegistry");
  const unifiedVerifierAddress = getDeployedContractAddress(network, "UnifiedPaymentVerifier");

  // Add PayPal to payment method registry
  const paymentVerifierRegistryContract = await ethers.getContractAt(
    "PaymentVerifierRegistry", paymentVerifierRegistryAddress
  );
  await addPaymentMethodToRegistry(
    hre,
    paymentVerifierRegistryContract,
    PAYPAL_PROVIDER_CONFIG.paymentMethodHash,
    unifiedVerifierAddress,
    PAYPAL_PROVIDER_CONFIG.currencies
  );
  console.log("PayPal added to payment method registry...");

  // Snapshot PayPal
  savePaymentMethodSnapshot(network, 'paypal', {
    paymentMethodHash: PAYPAL_PROVIDER_CONFIG.paymentMethodHash,
    currencies: PAYPAL_PROVIDER_CONFIG.currencies,
    timestampBuffer: PAYPAL_PROVIDER_CONFIG.timestampBuffer
  });

  // PayPal returns single payment details
  // Add PayPal to unified verifier
  const unifiedVerifierContract = await ethers.getContractAt(
    "UnifiedPaymentVerifier", unifiedVerifierAddress
  );
  await addPaymentMethodToUnifiedVerifier(
    hre,
    unifiedVerifierContract,
    PAYPAL_PROVIDER_CONFIG.paymentMethodHash,
    PAYPAL_PROVIDER_CONFIG.timestampBuffer
  );
  console.log("PayPal added to unified verifier...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  return false;
};

export default func;
