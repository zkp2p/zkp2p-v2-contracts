import "module-alias/register";

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

import { getDeployedContractAddress } from "../deployments/helpers";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();

  // Get the deployed Escrow contract address
  const escrowAddress = getDeployedContractAddress(network, "Escrow");
  console.log("Using Escrow contract at:", escrowAddress);

  // Deploy EscrowViewer
  const escrowViewer = await deploy("EscrowViewer", {
    from: deployer,
    args: [escrowAddress],
  });
  console.log("EscrowViewer deployed at", escrowViewer.address);

  console.log("EscrowViewer deployment finished...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  const network = hre.network.name;
  if (network != "localhost") {
    try { getDeployedContractAddress(hre.network.name, "EscrowViewer") } catch (e) { return false; }
    return true;
  }
  return false;
};

func.tags = ["EscrowViewer"];
func.dependencies = ["Escrow"];

export default func;
