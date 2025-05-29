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
  ZELLE_RECLAIM_CURRENCIES,
  ZELLE_RECLAIM_TIMESTAMP_BUFFER,
  ZELLE_RECLAIM_FEE_SHARE,
  ZELLE_APPCLIP_PROVIDER_HASHES,
  getZelleCitiReclaimProviderHashes,
  getZelleBoAReclaimProviderHashes,
  getZelleChaseReclaimProviderHashes,
} from "../deployments/verifiers/zelle_reclaim";
import { ZERO } from "@utils/constants";

// Deployment Scripts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = await hre.deployments;
  const network = hre.deployments.getNetworkName();

  const [deployer] = await hre.getUnnamedAccounts();
  const multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer;

  const escrowAddress = getDeployedContractAddress(network, "Escrow");
  const nullifierRegistryAddress = getDeployedContractAddress(network, "NullifierRegistry");

  // Deploy ZelleBaseVerifier first
  const zelleBaseVerifier = await deploy("ZelleBaseVerifier", {
    from: deployer,
    args: [
      escrowAddress,
      nullifierRegistryAddress,
      ZERO,
      ZELLE_RECLAIM_CURRENCIES
    ],
  });
  console.log("ZelleBaseVerifier deployed at", zelleBaseVerifier.address);

  // Get the provider hashes for each bank's verifier
  // Citi Verifier
  const citiExtensionProviderHashes = await getZelleCitiReclaimProviderHashes(20);
  console.log("citi extension provider hashes", citiExtensionProviderHashes);
  const citiAppclipProviderHashes = ZELLE_APPCLIP_PROVIDER_HASHES;
  console.log("citi appclip provider hashes", citiAppclipProviderHashes);
  const citiProviderHashes = [...citiExtensionProviderHashes, ...citiAppclipProviderHashes];

  // BoA Verifier
  const boaExtensionProviderHashes = await getZelleBoAReclaimProviderHashes(10);
  console.log("boa extension provider hashes", boaExtensionProviderHashes);
  const boaAppclipProviderHashes = ZELLE_APPCLIP_PROVIDER_HASHES;
  console.log("boa appclip provider hashes", boaAppclipProviderHashes);
  const boaProviderHashes = [...boaExtensionProviderHashes, ...boaAppclipProviderHashes];

  // Chase Verifier
  const chaseExtensionProviderHashes = await getZelleChaseReclaimProviderHashes(10);
  console.log("chase extension provider hashes", chaseExtensionProviderHashes);
  const chaseAppclipProviderHashes = ZELLE_APPCLIP_PROVIDER_HASHES;
  console.log("chase appclip provider hashes", chaseAppclipProviderHashes);
  const chaseProviderHashes = [...chaseExtensionProviderHashes, ...chaseAppclipProviderHashes];

  // Deploy individual verifiers that connect to ZelleBaseVerifier
  // Citi
  const citiTimestampBuffer = ZELLE_RECLAIM_TIMESTAMP_BUFFER['citi'];
  console.log("citi timestamp buffer", citiTimestampBuffer);
  const citiVerifier = await deploy("ZelleCitiReclaimVerifier", {
    from: deployer,
    args: [
      zelleBaseVerifier.address,
      nullifierRegistryAddress,
      citiProviderHashes,
      citiTimestampBuffer
    ],
  });
  console.log("ZelleCitiReclaimVerifier deployed at", citiVerifier.address);

  // BoA
  const boaTimestampBuffer = ZELLE_RECLAIM_TIMESTAMP_BUFFER['bofa'];
  console.log("boa timestamp buffer", boaTimestampBuffer);
  const boaVerifier = await deploy("ZelleBoAReclaimVerifier", {
    from: deployer,
    args: [
      zelleBaseVerifier.address,
      nullifierRegistryAddress,
      boaProviderHashes,
      boaTimestampBuffer
    ],
  });
  console.log("ZelleBoAReclaimVerifier deployed at", boaVerifier.address);

  // Chase
  const chaseTimestampBuffer = ZELLE_RECLAIM_TIMESTAMP_BUFFER['chase'];
  console.log("chase timestamp buffer", chaseTimestampBuffer);
  const chaseVerifier = await deploy("ZelleChaseReclaimVerifier", {
    from: deployer,
    args: [
      zelleBaseVerifier.address,
      nullifierRegistryAddress,
      chaseProviderHashes,
      chaseTimestampBuffer
    ],
  });
  console.log("ZelleChaseReclaimVerifier deployed at", chaseVerifier.address);

  // Add each verifier to ZelleBaseVerifier mapping
  const baseVerifierContract = await ethers.getContractAt("ZelleBaseVerifier", zelleBaseVerifier.address);

  // Payment method IDs for each bank
  const CHASE_PAYMENT_METHOD = 0;
  const BOA_PAYMENT_METHOD = 1;
  const CITI_PAYMENT_METHOD = 2;

  // Add mappings to ZelleBaseVerifier
  await baseVerifierContract.setPaymentMethodVerifier(CITI_PAYMENT_METHOD, citiVerifier.address);
  console.log(`Added Citi verifier as payment method ${CITI_PAYMENT_METHOD} to ZelleBaseVerifier`);

  await baseVerifierContract.setPaymentMethodVerifier(BOA_PAYMENT_METHOD, boaVerifier.address);
  console.log(`Added BoA verifier as payment method ${BOA_PAYMENT_METHOD} to ZelleBaseVerifier`);

  await baseVerifierContract.setPaymentMethodVerifier(CHASE_PAYMENT_METHOD, chaseVerifier.address);
  console.log(`Added Chase verifier as payment method ${CHASE_PAYMENT_METHOD} to ZelleBaseVerifier`);

  // Add write permissions to NullifierRegistry
  const nullifierRegistryContract = await ethers.getContractAt("NullifierRegistry", nullifierRegistryAddress);
  await addWritePermission(hre, nullifierRegistryContract, citiVerifier.address);
  await addWritePermission(hre, nullifierRegistryContract, boaVerifier.address);
  await addWritePermission(hre, nullifierRegistryContract, chaseVerifier.address);
  console.log("NullifierRegistry permissions added for Citi, BoA, and Chase verifiers...");

  // Add ZelleBaseVerifier to whitelist
  const escrowContract = await ethers.getContractAt("Escrow", escrowAddress);
  await addWhitelistedPaymentVerifier(hre, escrowContract, zelleBaseVerifier.address, ZELLE_RECLAIM_FEE_SHARE[network]);
  console.log("ZelleBaseVerifier added to whitelisted payment verifiers...");

  // Transfer ownership
  console.log("Transferring ownership of contracts...");
  await setNewOwner(
    hre,
    await ethers.getContractAt("ZelleBaseVerifier", zelleBaseVerifier.address),
    multiSig
  );
  await setNewOwner(
    hre,
    await ethers.getContractAt("ZelleCitiReclaimVerifier", citiVerifier.address),
    multiSig
  );
  await setNewOwner(
    hre,
    await ethers.getContractAt("ZelleBoAReclaimVerifier", boaVerifier.address),
    multiSig
  );
  await setNewOwner(
    hre,
    await ethers.getContractAt("ZelleChaseReclaimVerifier", chaseVerifier.address),
    multiSig
  );

  console.log("Deploy finished...");
};

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  const network = hre.network.name;
  if (network != "localhost") {
    try {
      getDeployedContractAddress(hre.network.name, "ZelleBaseVerifier");
      return true;
    } catch (e) { return false; }
  }
  return false;
};

export default func;
