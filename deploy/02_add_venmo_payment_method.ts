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
  saveProviderHashesSnapshot
} from "../deployments/helpers";
import { PaymentService } from "../utils/types";
import {
  getVenmoReclaimProviderHashes,
  VENMO_RECLAIM_CURRENCIES,
  VENMO_RECLAIM_TIMESTAMP_BUFFER,
  VENMO_PAYMENT_METHOD_HASH,
} from "../deployments/verifiers/venmo_reclaim";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;
  const paymentService = PaymentService.VenmoReclaim;

  const paymentVerifierRegistryAddress = getDeployedContractAddress(network, "PaymentVerifierRegistry");
  const unifiedVerifierAddress = getDeployedContractAddress(network, "UnifiedPaymentVerifier");


  // Add Venmo to payment method registry
  const paymentVerifierRegistryContract = await ethers.getContractAt(
    "PaymentVerifierRegistry", paymentVerifierRegistryAddress
  );
  await addPaymentMethodToRegistry(
    hre,
    paymentVerifierRegistryContract,
    VENMO_PAYMENT_METHOD_HASH,
    unifiedVerifierAddress,
    VENMO_RECLAIM_CURRENCIES
  );
  console.log("Venmo added to payment method registry...");

  // Venmo only returns 10 stories at a time
  const providerHashes = await getVenmoReclaimProviderHashes(10);
  console.log("venmo extension provider hashes", providerHashes);

  // Snapshot provider hashes
  saveProviderHashesSnapshot(network, 'venmo', {
    paymentMethodHash: VENMO_PAYMENT_METHOD_HASH,
    providerHashes
  });

  // Add Venmo to unified verifier
  const unifiedVerifierContract = await ethers.getContractAt(
    "UnifiedPaymentVerifier", unifiedVerifierAddress
  );
  await addPaymentMethodToUnifiedVerifier(
    hre,
    unifiedVerifierContract,
    VENMO_PAYMENT_METHOD_HASH,
    VENMO_RECLAIM_TIMESTAMP_BUFFER,
    providerHashes
  );
  console.log("Venmo added to unified verifier...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  return false;
};

export default func;
