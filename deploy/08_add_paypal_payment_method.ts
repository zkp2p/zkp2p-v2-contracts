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
  getPaypalReclaimProviderHashes,
  PAYPAL_RECLAIM_CURRENCIES,
  PAYPAL_RECLAIM_TIMESTAMP_BUFFER,
  PAYPAL_PAYMENT_METHOD_HASH,
} from "../deployments/verifiers/paypal_reclaim";

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
    PAYPAL_PAYMENT_METHOD_HASH,
    unifiedVerifierAddress,
    PAYPAL_RECLAIM_CURRENCIES
  );
  console.log("PayPal added to payment method registry...");

  // PayPal returns single payment details
  const providerHashes = await getPaypalReclaimProviderHashes();
  console.log("paypal extension provider hashes", providerHashes);

  // Snapshot provider hashes
  savePaymentMethodSnapshot(network, 'paypal', {
    paymentMethodHash: PAYPAL_PAYMENT_METHOD_HASH,
    providerHashes,
    currencies: PAYPAL_RECLAIM_CURRENCIES,
    timestampBuffer: PAYPAL_RECLAIM_TIMESTAMP_BUFFER
  });

  // Add PayPal to unified verifier
  const unifiedVerifierContract = await ethers.getContractAt(
    "UnifiedPaymentVerifier", unifiedVerifierAddress
  );
  await addPaymentMethodToUnifiedVerifier(
    hre,
    unifiedVerifierContract,
    PAYPAL_PAYMENT_METHOD_HASH,
    PAYPAL_RECLAIM_TIMESTAMP_BUFFER,
    providerHashes
  );
  console.log("PayPal added to unified verifier...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  return false;
};

export default func;