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
import { MERCADOPAGO_PROVIDER_CONFIG } from "../deployments/verifiers/mercadopago";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;

  const paymentVerifierRegistryAddress = getDeployedContractAddress(network, "PaymentVerifierRegistry");
  const unifiedVerifierAddress = getDeployedContractAddress(network, "UnifiedPaymentVerifier");

  // Add MercadoPago to payment method registry
  const paymentVerifierRegistryContract = await ethers.getContractAt(
    "PaymentVerifierRegistry", paymentVerifierRegistryAddress
  );
  await addPaymentMethodToRegistry(
    hre,
    paymentVerifierRegistryContract,
    MERCADOPAGO_PROVIDER_CONFIG.paymentMethodHash,
    unifiedVerifierAddress,
    MERCADOPAGO_PROVIDER_CONFIG.currencies
  );
  console.log("MercadoPago added to payment method registry...");

  // Snapshot currencies and timestamp buffer
  savePaymentMethodSnapshot(network, 'mercadopago', {
    paymentMethodHash: MERCADOPAGO_PROVIDER_CONFIG.paymentMethodHash,
    currencies: MERCADOPAGO_PROVIDER_CONFIG.currencies,
    timestampBuffer: MERCADOPAGO_PROVIDER_CONFIG.timestampBuffer
  });

  // Add MercadoPago to unified verifier
  const unifiedVerifierContract = await ethers.getContractAt(
    "UnifiedPaymentVerifier", unifiedVerifierAddress
  );
  await addPaymentMethodToUnifiedVerifier(
    hre,
    unifiedVerifierContract,
    MERCADOPAGO_PROVIDER_CONFIG.paymentMethodHash,
    MERCADOPAGO_PROVIDER_CONFIG.timestampBuffer
  );
  console.log("MercadoPago added to unified verifier...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  return false;
};

export default func;
