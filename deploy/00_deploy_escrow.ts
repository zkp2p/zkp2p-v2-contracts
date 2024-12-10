import "module-alias/register";

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const circom = require("circomlibjs");

import {
  INTENT_EXPIRATION_PERIOD,
  MULTI_SIG,
  SUSTAINABILITY_FEE,
  SUSTAINABILITY_FEE_RECIPIENT,
  USDC,
  USDC_MINT_AMOUNT,
  USDC_RECIPIENT,
} from "../deployments/parameters";
import { getDeployedContractAddress, setNewOwner } from "../deployments/helpers";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();
  const chainId = (await ethers.provider.getNetwork()).chainId;

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;

  let usdcAddress;
  if (!USDC[network]) {
    const usdcToken = await deploy("USDCMock", {
      from: deployer,
      args: [USDC_MINT_AMOUNT, "USDC", "USDC"],
    });
    usdcAddress = usdcToken.address;
    console.log("USDC deployed...");
  } else {
    usdcAddress = USDC[network];
  }

  const escrow = await deploy("Escrow", {
    from: deployer,
    args: [
      deployer,
      chainId,
      INTENT_EXPIRATION_PERIOD[network],
      SUSTAINABILITY_FEE[network],
      SUSTAINABILITY_FEE_RECIPIENT[network] != ""
        ? SUSTAINABILITY_FEE_RECIPIENT[network]
        : deployer,
    ],
  });
  console.log("Escrow deployed at", escrow.address);

  const nullifierRegistry = await deploy("NullifierRegistry", {
    from: deployer,
    args: [],
  });
  console.log("Nullifier deployed at", nullifierRegistry.address);

  const escrowContract = await ethers.getContractAt("Escrow", escrow.address);
  const nullifierRegistryContract = await ethers.getContractAt("NullifierRegistry", nullifierRegistry.address);

  if (network == "goerli") {
    const usdcContract = await ethers.getContractAt("USDCMock", usdcAddress);
    await usdcContract.transfer(USDC_RECIPIENT, USDC_MINT_AMOUNT);
  }

  if (network == "localhost") {
    const [owner] = await ethers.getSigners();
    const usdcContract = await ethers.getContractAt("USDCMock", usdcAddress);
    await usdcContract.transfer(owner.address, USDC_MINT_AMOUNT);
    console.log("Transferred USDC to ", owner.address);
  }

  console.log("Transferring ownership of contracts...");
  await setNewOwner(hre, escrowContract, multiSig);
  await setNewOwner(hre, nullifierRegistryContract, multiSig);

  console.log("Deploy finished...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  const network = hre.network.name;
  if (network != "localhost") {
    try { getDeployedContractAddress(hre.network.name, "Ramp") } catch (e) { return false; }
    return true;
  }
  return false;
};

export default func;
