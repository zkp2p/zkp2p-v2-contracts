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
  getWiseReclaimProviderHashes,
  WISE_RECLAIM_CURRENCIES,
  WISE_RECLAIM_TIMESTAMP_BUFFER,
  WISE_RECLAIM_FEE_SHARE,
  WISE_APPCLIP_PROVIDER_HASHES,
} from "../deployments/verifiers/wise_reclaim";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;

  const escrowAddress = getDeployedContractAddress(network, "Escrow");
  const nullifierRegistryAddress = getDeployedContractAddress(network, "NullifierRegistry");

  // Wise only returns 1 transaction at a time
  const extensionProviderHashes = await getWiseReclaimProviderHashes(1);
  console.log("wise extension provider hashes", extensionProviderHashes);

  const appclipProviderHashes = WISE_APPCLIP_PROVIDER_HASHES;
  console.log("wise appclip provider hashes", appclipProviderHashes);
  const providerHashes = [...extensionProviderHashes, ...appclipProviderHashes];
  const wiseVerifier = await deploy("WiseReclaimVerifier", {
    from: deployer,
    args: [
      escrowAddress,
      nullifierRegistryAddress,
      WISE_RECLAIM_TIMESTAMP_BUFFER,
      WISE_RECLAIM_CURRENCIES,
      providerHashes,
    ],
  });
  console.log("WiseReclaimVerifier deployed at", wiseVerifier.address);

  const nullifierRegistryContract = await ethers.getContractAt("NullifierRegistry", nullifierRegistryAddress);
  await addWritePermission(hre, nullifierRegistryContract, wiseVerifier.address);

  console.log("NullifierRegistry permissions added...");

  const escrowContract = await ethers.getContractAt("Escrow", escrowAddress);
  await addWhitelistedPaymentVerifier(hre, escrowContract, wiseVerifier.address, WISE_RECLAIM_FEE_SHARE);

  console.log("WiseReclaimVerifier added to whitelisted payment verifiers...");

  console.log("Transferring ownership of contracts...");
  await setNewOwner(
    hre,
    await ethers.getContractAt("WiseReclaimVerifier", wiseVerifier.address),
    multiSig
  );

  console.log("Deploy finished...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  const network = hre.network.name;
  if (network != "localhost") {
    try { getDeployedContractAddress(hre.network.name, "WiseReclaimVerifier") } catch (e) { return false; }
    return true;
  }
  return false;
};

export default func;
