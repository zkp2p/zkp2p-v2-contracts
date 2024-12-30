import "module-alias/register";

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { getDeployedContractAddress } from "../deployments/helpers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments;
  const [deployer] = await hre.getUnnamedAccounts();

  const mintAmount = ethers.utils.parseUnits("1000000", 18);

  const usdt = await deploy("USDT", {
    contract: "ERC20Mock",
    from: deployer,
    args: [mintAmount, "Tether USD", "USDT"],
  });
  console.log("USDT deployed at", usdt.address);

  const weth = await deploy("WETH", {
    contract: "ERC20Mock",
    from: deployer,
    args: [mintAmount, "Wrapped Ether", "WETH"],
  });
  console.log("WETH deployed at", weth.address);

  console.log("Deploy finished...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  const network = hre.network.name;
  if (network != "localhost") {
    try { getDeployedContractAddress(hre.network.name, "USDT") } catch (e) { return false; }
    return true;
  }
  return false;
};

export default func;
