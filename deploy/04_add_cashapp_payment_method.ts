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
  getCashappReclaimProviderHashes,
  CASHAPP_RECLAIM_CURRENCIES,
  CASHAPP_RECLAIM_TIMESTAMP_BUFFER,
  CASHAPP_PAYMENT_METHOD_HASH,
} from "../deployments/verifiers/cashapp_reclaim";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;
  const paymentService = PaymentService.CashappReclaim;

  const paymentVerifierRegistryAddress = getDeployedContractAddress(network, "PaymentVerifierRegistry");
  const unifiedVerifierAddress = getDeployedContractAddress(network, "UnifiedPaymentVerifier");


  // Add CashApp to payment method registry
  const paymentVerifierRegistryContract = await ethers.getContractAt(
    "PaymentVerifierRegistry", paymentVerifierRegistryAddress
  );
  await addPaymentMethodToRegistry(
    hre,
    paymentVerifierRegistryContract,
    CASHAPP_PAYMENT_METHOD_HASH,
    unifiedVerifierAddress,
    CASHAPP_RECLAIM_CURRENCIES
  );
  console.log("CashApp added to payment method registry...");

  // CashApp returns 20 activities at a time
  const providerHashes = await getCashappReclaimProviderHashes(20);
  console.log("cashapp extension provider hashes", providerHashes);

  // Add CashApp to unified verifier
  const unifiedVerifierContract = await ethers.getContractAt(
    "UnifiedPaymentVerifier", unifiedVerifierAddress
  );
  await addPaymentMethodToUnifiedVerifier(
    hre,
    unifiedVerifierContract,
    CASHAPP_PAYMENT_METHOD_HASH,
    CASHAPP_RECLAIM_TIMESTAMP_BUFFER,
    providerHashes
  );
  console.log("CashApp added to unified verifier...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  return false;
};

export default func;