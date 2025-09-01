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
  getMercadoReclaimProviderHashes,
  MERCADO_RECLAIM_CURRENCIES,
  MERCADO_RECLAIM_TIMESTAMP_BUFFER,
  MERCADOPAGO_PAYMENT_METHOD_HASH,
} from "../deployments/verifiers/mercado_pago_reclaim";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;
  const paymentService = PaymentService.MercadoReclaim;

  const paymentVerifierRegistryAddress = getDeployedContractAddress(network, "PaymentVerifierRegistry");
  const unifiedVerifierAddress = getDeployedContractAddress(network, "UnifiedPaymentVerifier");

  // Add MercadoPago to payment method registry
  const paymentVerifierRegistryContract = await ethers.getContractAt(
    "PaymentVerifierRegistry", paymentVerifierRegistryAddress
  );
  await addPaymentMethodToRegistry(
    hre,
    paymentVerifierRegistryContract,
    MERCADOPAGO_PAYMENT_METHOD_HASH,
    unifiedVerifierAddress,
    MERCADO_RECLAIM_CURRENCIES
  );
  console.log("MercadoPago added to payment method registry...");

  // Get MercadoPago provider hashes
  const providerHashes = await getMercadoReclaimProviderHashes(1);
  console.log("mercadopago extension provider hashes", providerHashes);

  // Snapshot provider hashes
  saveProviderHashesSnapshot(network, 'mercadopago', {
    paymentMethodHash: MERCADOPAGO_PAYMENT_METHOD_HASH,
    providerHashes
  });

  // Add MercadoPago to unified verifier
  const unifiedVerifierContract = await ethers.getContractAt(
    "UnifiedPaymentVerifier", unifiedVerifierAddress
  );
  await addPaymentMethodToUnifiedVerifier(
    hre,
    unifiedVerifierContract,
    MERCADOPAGO_PAYMENT_METHOD_HASH,
    MERCADO_RECLAIM_TIMESTAMP_BUFFER,
    providerHashes
  );
  console.log("MercadoPago added to unified verifier...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  return false;
};

export default func;