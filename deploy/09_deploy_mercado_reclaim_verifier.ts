import "module-alias/register";

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

import {
  MULTI_SIG,
} from "../deployments/parameters";
import {
  addWritePermission,
  addWhitelistedPaymentVerifier,
  getDeployedContractAddress,
  setNewOwner
} from "../deployments/helpers";
import { PaymentService } from "../utils/types";
import {
  getMercadoReclaimProviderHashes,
  MERCADO_RECLAIM_CURRENCIES,
  MERCADO_RECLAIM_TIMESTAMP_BUFFER,
  MERCADO_RECLAIM_FEE_SHARE,
  MERCADO_APPCLIP_PROVIDER_HASHES,
} from "../deployments/verifiers/mercado_pago_reclaim";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;

  const escrowAddress = getDeployedContractAddress(network, "Escrow");
  const nullifierRegistryAddress = getDeployedContractAddress(network, "NullifierRegistry");

  // Mercado only returns 1 transaction at a time
  const extensionProviderHashes = await getMercadoReclaimProviderHashes(1);
  console.log("mercado extension provider hashes", extensionProviderHashes);

  const appclipProviderHashes = MERCADO_APPCLIP_PROVIDER_HASHES;
  console.log("mercado appclip provider hashes", appclipProviderHashes);
  const providerHashes = [...extensionProviderHashes, ...appclipProviderHashes];
  const mercadoVerifier = await deploy("MercadoPagoReclaimVerifier", {
    from: deployer,
    args: [
      escrowAddress,
      nullifierRegistryAddress,
      MERCADO_RECLAIM_TIMESTAMP_BUFFER,
      MERCADO_RECLAIM_CURRENCIES,
      providerHashes,
    ],
  });
  console.log("MercadoPagoReclaimVerifier deployed at", mercadoVerifier.address);

  const nullifierRegistryContract = await ethers.getContractAt("NullifierRegistry", nullifierRegistryAddress);
  await addWritePermission(hre, nullifierRegistryContract, mercadoVerifier.address);

  console.log("NullifierRegistry permissions added...");

  const escrowContract = await ethers.getContractAt("Escrow", escrowAddress);
  await addWhitelistedPaymentVerifier(
    hre,
    escrowContract,
    mercadoVerifier.address,
    MERCADO_RECLAIM_FEE_SHARE[network]
  );

  console.log("MercadoPagoReclaimVerifier added to whitelisted payment verifiers...");

  console.log("Transferring ownership of contracts...");
  await setNewOwner(
    hre,
    await ethers.getContractAt("MercadoPagoReclaimVerifier", mercadoVerifier.address),
    multiSig
  );

  console.log("Deploy finished...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  const network = hre.network.name;
  if (network != "localhost") {
    try { getDeployedContractAddress(hre.network.name, "MercadoPagoReclaimVerifier") } catch (e) { return false; }
    return true;
  }
  return false;
};

export default func;
