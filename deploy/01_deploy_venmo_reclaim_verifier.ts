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
  VENMO_RECLAIM_PROVIDER_HASHES,
  VENMO_RECLAIM_CURRENCIES,
  VENMO_RECLAIM_TIMESTAMP_BUFFER,
  VENMO_RECLAIM_FEE_SHARE,
} from "../deployments/verifiers/venmo_reclaim";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;
  const paymentService = PaymentService.VenmoReclaim;

  const escrowAddress = getDeployedContractAddress(network, "Escrow");
  const nullifierRegistryAddress = getDeployedContractAddress(network, "NullifierRegistry");

  // Deploy ClaimVerifier
  const claimVerifier = await deploy("ClaimVerifier", {
    from: deployer,
    args: [],
  });
  console.log("ClaimVerifier deployed at", claimVerifier.address);

  const venmoVerifier = await deploy("VenmoReclaimVerifier", {
    from: deployer,
    libraries: {
      ClaimVerifier: claimVerifier.address,
    },
    args: [
      escrowAddress,
      nullifierRegistryAddress,
      VENMO_RECLAIM_TIMESTAMP_BUFFER,
      VENMO_RECLAIM_CURRENCIES,
      VENMO_RECLAIM_PROVIDER_HASHES,
    ],
  });
  console.log("VenmoReclaimVerifier deployed at", venmoVerifier.address);

  const nullifierRegistryContract = await ethers.getContractAt("NullifierRegistry", nullifierRegistryAddress);
  await addWritePermission(hre, nullifierRegistryContract, venmoVerifier.address);

  console.log("NullifierRegistry permissions added...");

  const escrowContract = await ethers.getContractAt("Escrow", escrowAddress);
  await addWhitelistedPaymentVerifier(hre, escrowContract, venmoVerifier.address, VENMO_RECLAIM_FEE_SHARE);

  console.log("VenmoReclaimVerifier added to whitelisted payment verifiers...");

  console.log("Transferring ownership of contracts...");
  await setNewOwner(
    hre,
    await ethers.getContractAt("VenmoReclaimVerifier", venmoVerifier.address),
    multiSig
  );

  console.log("Deploy finished...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  const network = hre.network.name;
  if (network != "localhost") {
    try { getDeployedContractAddress(hre.network.name, "VenmoVerifier") } catch (e) { return false; }
    return true;
  }
  return false;
};

export default func;
