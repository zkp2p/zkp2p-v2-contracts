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
  VENMO_PROVIDER_CONFIG
} from "../deployments/verifiers/venmo";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;

  const paymentVerifierRegistryAddress = getDeployedContractAddress(network, "PaymentVerifierRegistry");
  const unifiedVerifierAddress = getDeployedContractAddress(network, "UnifiedPaymentVerifier");


  // Add Venmo to payment method registry
  const paymentVerifierRegistryContract = await ethers.getContractAt(
    "PaymentVerifierRegistry", paymentVerifierRegistryAddress
  );
  await addPaymentMethodToRegistry(
    hre,
    paymentVerifierRegistryContract,
    VENMO_PROVIDER_CONFIG.paymentMethodHash,
    unifiedVerifierAddress,
    VENMO_PROVIDER_CONFIG.currencies
  );
  console.log("Venmo added to payment method registry...");

  // Snapshot currencies and timestamp buffer (no provider hashes on-chain)
  savePaymentMethodSnapshot(network, 'venmo', {
    paymentMethodHash: VENMO_PROVIDER_CONFIG.paymentMethodHash,
    currencies: VENMO_PROVIDER_CONFIG.currencies,
    timestampBuffer: VENMO_PROVIDER_CONFIG.timestampBuffer
  });

  // Add Venmo to unified verifier
  const unifiedVerifierContract = await ethers.getContractAt(
    "UnifiedPaymentVerifier", unifiedVerifierAddress
  );
  await addPaymentMethodToUnifiedVerifier(
    hre,
    unifiedVerifierContract,
    VENMO_PROVIDER_CONFIG.paymentMethodHash,
    VENMO_PROVIDER_CONFIG.timestampBuffer
  );
  console.log("Venmo added to unified verifier...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  return false;
};

export default func;
