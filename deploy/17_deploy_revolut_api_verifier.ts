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
  REVOLUT_API_RECLAIM_ATTESTOR,
  REVOLUT_API_FEE_SHARE,
} from "../deployments/verifiers/revolut_api";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments;
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;

  const escrowAddress = getDeployedContractAddress(network, "Escrow");
  const nullifierRegistryAddress = getDeployedContractAddress(network, "NullifierRegistry");

  console.log("Deploying RevolutApiVerifier with:");
  console.log("- Escrow:", escrowAddress);
  console.log("- NullifierRegistry:", nullifierRegistryAddress);
  console.log("- Reclaim Attestor:", REVOLUT_API_RECLAIM_ATTESTOR);

  const revolutApiVerifier = await deploy("RevolutApiVerifier", {
    from: deployer,
    args: [
      escrowAddress,
      nullifierRegistryAddress,
      REVOLUT_API_RECLAIM_ATTESTOR,
    ],
  });
  console.log("RevolutApiVerifier deployed at", revolutApiVerifier.address);

  const nullifierRegistryContract = await ethers.getContractAt("NullifierRegistry", nullifierRegistryAddress);
  await addWritePermission(hre, nullifierRegistryContract, revolutApiVerifier.address);

  console.log("NullifierRegistry permissions added...");

  const escrowContract = await ethers.getContractAt("Escrow", escrowAddress);
  await addWhitelistedPaymentVerifier(
    hre,
    escrowContract,
    revolutApiVerifier.address,
    REVOLUT_API_FEE_SHARE[network]
  );

  console.log("RevolutApiVerifier added to whitelisted payment verifiers...");

  console.log("Transferring ownership of contracts...");
  await setNewOwner(
    hre,
    await ethers.getContractAt("RevolutApiVerifier", revolutApiVerifier.address),
    multiSig
  );

  console.log("Deploy finished...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  const network = hre.network.name;
  if (network != "localhost") {
    try { getDeployedContractAddress(hre.network.name, "RevolutApiVerifier") } catch (e) { return false; }
    return true;
  }
  return false;
};

export default func;