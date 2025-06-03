import "module-alias/register";

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { getDeployedContractAddress } from "../../deployments/helpers";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();

  const escrowAddress = await getDeployedContractAddress(network, "Escrow");

  const quoter = await deploy("Quoter", {
    from: deployer,
    args: [
      escrowAddress,
    ],
  });
  console.log("Quoter deployed at", quoter.address);

  console.log("Deploy finished...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  return true;
};

export default func;
