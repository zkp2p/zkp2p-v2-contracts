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
import {
  PAYPAL_RECLAIM_CURRENCIES,
  PAYPAL_RECLAIM_TIMESTAMP_BUFFER,
  PAYPAL_RECLAIM_FEE_SHARE,
  getPaypalReclaimProviderHashes,
} from "../deployments/verifiers/paypal_reclaim";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments;
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;

  const escrowAddress = getDeployedContractAddress(network, "Escrow");
  const nullifierRegistryAddress = getDeployedContractAddress(network, "NullifierRegistry");

  const paypalProviderHashes = await getPaypalReclaimProviderHashes();
  const paypalVerifier = await deploy("PaypalReclaimVerifier", {
    from: deployer,
    args: [
      escrowAddress,
      nullifierRegistryAddress,
      PAYPAL_RECLAIM_TIMESTAMP_BUFFER,
      PAYPAL_RECLAIM_CURRENCIES,
      paypalProviderHashes,
    ],
  });
  console.log("PaypalReclaimVerifier deployed at", paypalVerifier.address);

  const nullifierRegistryContract = await ethers.getContractAt("NullifierRegistry", nullifierRegistryAddress);
  await addWritePermission(hre, nullifierRegistryContract, paypalVerifier.address);

  console.log("NullifierRegistry permissions added...");

  const escrowContract = await ethers.getContractAt("Escrow", escrowAddress);
  await addWhitelistedPaymentVerifier(
    hre,
    escrowContract,
    paypalVerifier.address,
    PAYPAL_RECLAIM_FEE_SHARE[network]
  );

  console.log("PaypalReclaimVerifier added to whitelisted payment verifiers...");

  console.log("Transferring ownership of contracts...");
  await setNewOwner(
    hre,
    await ethers.getContractAt("PaypalReclaimVerifier", paypalVerifier.address),
    multiSig
  );

  console.log("Deploy finished...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  const network = hre.network.name;
  if (network != "localhost") {
    try { getDeployedContractAddress(hre.network.name, "PaypalReclaimVerifier") } catch (e) { return false; }
    return true;
  }
  return false;
};

export default func;