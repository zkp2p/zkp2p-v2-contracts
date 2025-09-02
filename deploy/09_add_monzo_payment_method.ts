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
import { PaymentService } from "../utils/types";
import {
  getMonzoReclaimProviderHashes,
  MONZO_RECLAIM_CURRENCIES,
  MONZO_RECLAIM_TIMESTAMP_BUFFER,
  MONZO_PAYMENT_METHOD_HASH,
} from "../deployments/verifiers/monzo_reclaim";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;
  const paymentService = PaymentService.MonzoReclaim;

  const paymentVerifierRegistryAddress = getDeployedContractAddress(network, "PaymentVerifierRegistry");
  const unifiedVerifierAddress = getDeployedContractAddress(network, "UnifiedPaymentVerifier");

  // Add Monzo to payment method registry
  const paymentVerifierRegistryContract = await ethers.getContractAt(
    "PaymentVerifierRegistry", paymentVerifierRegistryAddress
  );
  await addPaymentMethodToRegistry(
    hre,
    paymentVerifierRegistryContract,
    MONZO_PAYMENT_METHOD_HASH,
    unifiedVerifierAddress,
    MONZO_RECLAIM_CURRENCIES
  );
  console.log("Monzo added to payment method registry...");

  // Monzo returns single transaction details
  const providerHashes = await getMonzoReclaimProviderHashes();
  console.log("monzo extension provider hashes", providerHashes);

  // Snapshot provider hashes
  savePaymentMethodSnapshot(network, 'monzo', {
    paymentMethodHash: MONZO_PAYMENT_METHOD_HASH,
    providerHashes,
    currencies: MONZO_RECLAIM_CURRENCIES,
    timestampBuffer: MONZO_RECLAIM_TIMESTAMP_BUFFER
  });

  // Add Monzo to unified verifier
  const unifiedVerifierContract = await ethers.getContractAt(
    "UnifiedPaymentVerifier", unifiedVerifierAddress
  );
  await addPaymentMethodToUnifiedVerifier(
    hre,
    unifiedVerifierContract,
    MONZO_PAYMENT_METHOD_HASH,
    MONZO_RECLAIM_TIMESTAMP_BUFFER,
    providerHashes
  );
  console.log("Monzo added to unified verifier...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  return false;
};

export default func;