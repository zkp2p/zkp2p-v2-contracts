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
  addPaymentMethodToUnifiedVerifier
} from "../deployments/helpers";
import { PaymentService } from "../utils/types";
import {
  getRevolutReclaimProviderHashes,
  REVOLUT_RECLAIM_CURRENCIES,
  REVOLUT_RECLAIM_TIMESTAMP_BUFFER,
  REVOLUT_PAYMENT_METHOD_HASH,
} from "../deployments/verifiers/revolut_reclaim";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;
  const paymentService = PaymentService.RevolutReclaim;

  const paymentVerifierRegistryAddress = getDeployedContractAddress(network, "PaymentVerifierRegistry");
  const unifiedVerifierAddress = getDeployedContractAddress(network, "UnifiedPaymentVerifier");

  // Add Revolut to payment method registry
  const paymentVerifierRegistryContract = await ethers.getContractAt(
    "PaymentVerifierRegistry", paymentVerifierRegistryAddress
  );
  await addPaymentMethodToRegistry(
    hre,
    paymentVerifierRegistryContract,
    REVOLUT_PAYMENT_METHOD_HASH,
    unifiedVerifierAddress,
    REVOLUT_RECLAIM_CURRENCIES
  );
  console.log("Revolut added to payment method registry...");

  // Revolut returns 20 transactions at a time
  const providerHashes = await getRevolutReclaimProviderHashes(20);
  console.log("revolut extension provider hashes", providerHashes);

  // Add Revolut to unified verifier
  const unifiedVerifierContract = await ethers.getContractAt(
    "UnifiedPaymentVerifier", unifiedVerifierAddress
  );
  await addPaymentMethodToUnifiedVerifier(
    hre,
    unifiedVerifierContract,
    REVOLUT_PAYMENT_METHOD_HASH,
    REVOLUT_RECLAIM_TIMESTAMP_BUFFER,
    providerHashes
  );
  console.log("Revolut added to unified verifier...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  return false;
};

export default func;