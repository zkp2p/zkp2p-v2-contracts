import "module-alias/register";

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

import {
  MULTI_SIG,
} from "../deployments/parameters";
import {
  addWritePermission,
  getDeployedContractAddress,
  setNewOwner
} from "../deployments/helpers";
import { WITNESS_ADDRESS, ZKTLS_ATTESTOR_ADDRESS } from "../deployments/parameters";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;

  const orchestratorAddress = getDeployedContractAddress(network, "Orchestrator");
  const nullifierRegistryAddress = getDeployedContractAddress(network, "NullifierRegistry");

  // Deploy SimpleAttestationVerifier
  const simpleAttestationVerifier = await deploy("SimpleAttestationVerifier", {
    from: deployer,
    args: [
      WITNESS_ADDRESS[network],
      ZKTLS_ATTESTOR_ADDRESS[network],
    ],
  });
  console.log("SimpleAttestationVerifier deployed at", simpleAttestationVerifier.address);

  // Deploy UnifiedPaymentVerifier
  const unifiedPaymentVerifier = await deploy("UnifiedPaymentVerifier", {
    from: deployer,
    args: [
      orchestratorAddress,
      nullifierRegistryAddress,
      simpleAttestationVerifier.address,
    ],
  });
  console.log("UnifiedPaymentVerifier deployed at", unifiedPaymentVerifier.address);

  // Get contract instances
  const nullifierRegistryContract = await ethers.getContractAt("NullifierRegistry", nullifierRegistryAddress);
  const simpleAttestationVerifierContract = await ethers.getContractAt("SimpleAttestationVerifier", simpleAttestationVerifier.address);
  const unifiedPaymentVerifierContract = await ethers.getContractAt("UnifiedPaymentVerifier", unifiedPaymentVerifier.address);

  await addWritePermission(hre, nullifierRegistryContract, unifiedPaymentVerifier.address);
  console.log("NullifierRegistry permissions added for UnifiedPaymentVerifier...");

  console.log("Transferring ownership of contracts...");
  await setNewOwner(hre, simpleAttestationVerifierContract, multiSig);
  console.log("SimpleAttestationVerifier ownership transferred to", multiSig);
  await setNewOwner(hre, unifiedPaymentVerifierContract, multiSig);
  console.log("UnifiedPaymentVerifier ownership transferred to", multiSig);

  console.log("Deploy finished...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  const network = hre.network.name;
  if (network != "localhost") {
    try {
      getDeployedContractAddress(hre.network.name, "UnifiedPaymentVerifier");
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
};

func.dependencies = ["00_deploy_system"];

export default func;