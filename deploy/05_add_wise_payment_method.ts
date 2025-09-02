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
  getWiseReclaimProviderHashes,
  WISE_RECLAIM_CURRENCIES,
  WISE_RECLAIM_TIMESTAMP_BUFFER,
  WISE_PAYMENT_METHOD_HASH,
} from "../deployments/verifiers/wise_reclaim";

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
    WISE_PAYMENT_METHOD_HASH,
    unifiedVerifierAddress,
    WISE_RECLAIM_CURRENCIES
  );
  console.log("Wise added to payment method registry...");

  // Get Wise provider hashes
  const providerHashes = await getWiseReclaimProviderHashes(1);
  console.log("wise extension provider hashes", providerHashes);

  // Snapshot provider hashes
  savePaymentMethodSnapshot(network, 'wise', {
    paymentMethodHash: WISE_PAYMENT_METHOD_HASH,
    providerHashes,
    currencies: WISE_RECLAIM_CURRENCIES,
    timestampBuffer: WISE_RECLAIM_TIMESTAMP_BUFFER
  });

  // Add Wise to unified verifier
  const unifiedVerifierContract = await ethers.getContractAt(
    "UnifiedPaymentVerifier", unifiedVerifierAddress
  );
  await addPaymentMethodToUnifiedVerifier(
    hre,
    unifiedVerifierContract,
    WISE_PAYMENT_METHOD_HASH,
    WISE_RECLAIM_TIMESTAMP_BUFFER,
    providerHashes
  );
  console.log("Wise added to unified verifier...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  return false;
};

export default func;
