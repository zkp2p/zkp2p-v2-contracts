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
  MONZO_RECLAIM_PROVIDER_HASHES,
  MONZO_RECLAIM_CURRENCIES,
  MONZO_RECLAIM_TIMESTAMP_BUFFER,
  MONZO_RECLAIM_FEE_SHARE,
} from "../deployments/verifiers/monzo_reclaim";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments;
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;

  const escrowAddress = getDeployedContractAddress(network, "Escrow");
  const nullifierRegistryAddress = getDeployedContractAddress(network, "NullifierRegistry");

  const monzoVerifier = await deploy("MonzoReclaimVerifier", {
    from: deployer,
    args: [
      escrowAddress,
      nullifierRegistryAddress,
      MONZO_RECLAIM_TIMESTAMP_BUFFER,
      MONZO_RECLAIM_CURRENCIES,
      MONZO_RECLAIM_PROVIDER_HASHES,
    ],
  });
  console.log("MonzoReclaimVerifier deployed at", monzoVerifier.address);

  const nullifierRegistryContract = await ethers.getContractAt("NullifierRegistry", nullifierRegistryAddress);
  await addWritePermission(hre, nullifierRegistryContract, monzoVerifier.address);

  console.log("NullifierRegistry permissions added...");

  const escrowContract = await ethers.getContractAt("Escrow", escrowAddress);
  await addWhitelistedPaymentVerifier(
    hre,
    escrowContract,
    monzoVerifier.address,
    MONZO_RECLAIM_FEE_SHARE[network]
  );

  console.log("MonzoReclaimVerifier added to whitelisted payment verifiers...");

  console.log("Transferring ownership of contracts...");
  await setNewOwner(
    hre,
    await ethers.getContractAt("MonzoReclaimVerifier", monzoVerifier.address),
    multiSig
  );

  console.log("Deploy finished...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  const network = hre.network.name;
  if (network != "localhost") {
    try { getDeployedContractAddress(hre.network.name, "MonzoReclaimVerifier") } catch (e) { return false; }
    return true;
  }
  return false;
};

export default func;