import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Address } from "../utils/types";
import { BigNumber } from "ethers";
import * as fs from "fs";
import * as path from "path";

export function getDeployedContractAddress(network: string, contractName: string): string {
  return require(`./${network}/${contractName}.json`).address;
}

export async function setNewOwner(
  hre: HardhatRuntimeEnvironment,
  contract: any,
  newOwner: Address
): Promise<void> {
  const currentOwner = await contract.owner();

  if (currentOwner != newOwner) {
    const data = contract.interface.encodeFunctionData("transferOwnership", [newOwner]);

    await hre.deployments.rawTx({
      from: currentOwner,
      to: contract.address,
      data
    });
  }
}

export async function setOrchestrator(
  hre: HardhatRuntimeEnvironment,
  contract: any,
  orchestrator: Address
): Promise<void> {
  const currentOwner = await contract.owner();

  if (!(await contract.orchestrator() == orchestrator)) {
    if ((await hre.getUnnamedAccounts()).includes(currentOwner)) {
      const data = contract.interface.encodeFunctionData("setOrchestrator", [orchestrator]);
      await hre.deployments.rawTx({
        from: currentOwner,
        to: contract.address,
        data
      });
    } else {
      console.log(
        `Contract owner is not in the list of accounts, must be manually added with the following calldata:
        ${contract.interface.encodeFunctionData("setOrchestrator", [orchestrator])}
        `
      );
    }
  }
}

export async function addEscrowToRegistry(
  hre: HardhatRuntimeEnvironment,
  contract: any,
  escrow: Address
): Promise<void> {
  const currentOwner = await contract.owner();

  if (!(await contract.isWhitelistedEscrow(escrow))) {
    if ((await hre.getUnnamedAccounts()).includes(currentOwner)) {
      const data = contract.interface.encodeFunctionData("addEscrow", [escrow]);
      await hre.deployments.rawTx({
        from: currentOwner,
        to: contract.address,
        data
      });
    } else {
      console.log(
        `Contract owner is not in the list of accounts, must be manually added with the following calldata:
        ${contract.interface.encodeFunctionData("addEscrow", [escrow])}
        `
      );
    }
  }
}


export async function addWritePermission(
  hre: HardhatRuntimeEnvironment,
  contract: any,
  newPermission: Address
): Promise<void> {
  const currentOwner = await contract.owner();
  if (!(await contract.isWriter(newPermission))) {
    if ((await hre.getUnnamedAccounts()).includes(currentOwner)) {
      const data = contract.interface.encodeFunctionData("addWritePermission", [newPermission]);

      await hre.deployments.rawTx({
        from: currentOwner,
        to: contract.address,
        data
      });
    } else {
      console.log(
        `Contract owner is not in the list of accounts, must be manually added with the following calldata:
        ${contract.interface.encodeFunctionData("addWritePermission", [newPermission])}
        `
      );
    }
  }
}

export async function addCurrency(
  hre: HardhatRuntimeEnvironment,
  contract: any,
  currency: string
): Promise<void> {
  const currentOwner = await contract.owner();
  const existingCurrencies = await contract.getCurrencies();
  if (!existingCurrencies.includes(currency)) {
    if ((await hre.getUnnamedAccounts()).includes(currentOwner)) {
      console.log("Adding currency ", currency, "to", contract.address);
      const data = contract.interface.encodeFunctionData("addCurrency", [currency]);
      await hre.deployments.rawTx({
        from: currentOwner,
        to: contract.address,
        data
      });
    } else {
      console.log(
        `Contract owner is not in the list of accounts, must be manually added with the following calldata:
        ${contract.interface.encodeFunctionData("addCurrency", [currency])}
        contract address: ${contract.address}
        `
      );
    }
  }
}


export async function removeProviderHash(
  hre: HardhatRuntimeEnvironment,
  contract: any,
  providerHash: string
): Promise<void> {
  const currentOwner = await contract.owner();
  const data = contract.interface.encodeFunctionData("removeProviderHash", [providerHash]);
  if (await contract.isProviderHash(providerHash)) {
    if ((await hre.getUnnamedAccounts()).includes(currentOwner)) {
      console.log("Removing provider hash ", providerHash, "from", contract.address);
      await hre.deployments.rawTx({
        from: currentOwner,
        to: contract.address,
        data
      });
    } else {
      console.log(
        `Contract owner is not in the list of accounts, must be manually added with the following calldata:
        ${contract.interface.encodeFunctionData("removeProviderHash", [providerHash])}
        contract address: ${contract.address}
        `
      );
    }
  }
}

export async function addProviderHash(
  hre: HardhatRuntimeEnvironment,
  contract: any,
  providerHash: string
): Promise<void> {
  const currentOwner = await contract.owner();
  const data = contract.interface.encodeFunctionData("addProviderHash", [providerHash]);
  if (!(await contract.isProviderHash(providerHash))) {
    if ((await hre.getUnnamedAccounts()).includes(currentOwner)) {
      console.log("Adding provider hash ", providerHash, "to", contract.address);
      await hre.deployments.rawTx({
        from: currentOwner,
        to: contract.address,
        data
      });
    } else {
      console.log(
        `Contract owner is not in the list of accounts, must be manually added with the following calldata:
        ${contract.interface.encodeFunctionData("addProviderHash", [providerHash])}
        contract address: ${contract.address}
        `
      );
    }
  } else {
    console.log("Provider hash", providerHash, "already exists in", contract.address);
  }
}

export async function addPaymentMethodToRegistry(
  hre: HardhatRuntimeEnvironment,
  paymentVerifierRegistryContract: any,
  paymentMethodHash: string,
  verifierAddress: Address,
  currencies: string[]
): Promise<void> {
  const currentOwner = await paymentVerifierRegistryContract.owner();
  const isPaymentMethod = await paymentVerifierRegistryContract.isPaymentMethod(paymentMethodHash);

  if (!isPaymentMethod) {
    if ((await hre.getUnnamedAccounts()).includes(currentOwner)) {
      console.log(`Adding payment method ${paymentMethodHash} to registry with verifier ${verifierAddress}`);
      const data = paymentVerifierRegistryContract.interface.encodeFunctionData("addPaymentMethod", [
        paymentMethodHash,
        verifierAddress,
        currencies
      ]);
      await hre.deployments.rawTx({
        from: currentOwner,
        to: paymentVerifierRegistryContract.address,
        data
      });
    } else {
      console.log(
        `Contract owner is not in the list of accounts, must be manually added with the following calldata:
        ${paymentVerifierRegistryContract.interface.encodeFunctionData("addPaymentMethod", [
          paymentMethodHash,
          verifierAddress,
          currencies
        ])}
        contract address: ${paymentVerifierRegistryContract.address}
        `
      );
    }
  } else {
    console.log(`Payment method ${paymentMethodHash} already exists in registry`);
  }
}

export async function addPaymentMethodToUnifiedVerifier(
  hre: HardhatRuntimeEnvironment,
  unifiedVerifierContract: any,
  paymentMethodHash: string,
  timestampBuffer: any,
  providerHashes: string[]
): Promise<void> {
  const currentOwner = await unifiedVerifierContract.owner();
  const paymentMethods = await unifiedVerifierContract.getPaymentMethods();

  if (!paymentMethods.includes(paymentMethodHash)) {
    if ((await hre.getUnnamedAccounts()).includes(currentOwner)) {
      console.log(`Adding payment method ${paymentMethodHash} to unified verifier with ${providerHashes.length} provider hashes`);
      const data = unifiedVerifierContract.interface.encodeFunctionData("addPaymentMethod", [
        paymentMethodHash,
        timestampBuffer,
        providerHashes
      ]);
      await hre.deployments.rawTx({
        from: currentOwner,
        to: unifiedVerifierContract.address,
        data
      });
    } else {
      console.log(
        `Contract owner is not in the list of accounts, must be manually added with the following calldata:
        ${unifiedVerifierContract.interface.encodeFunctionData("addPaymentMethod", [
          paymentMethodHash,
          timestampBuffer,
          providerHashes
        ])}
        contract address: ${unifiedVerifierContract.address}
        `
      );
    }
  } else {
    console.log(`Payment method ${paymentMethodHash} already exists in unified verifier`);
  }
}

// Persist payment method snapshots per network to avoid drift between code and configured on-chain state
export function savePaymentMethodSnapshot(
  network: string,
  methodKey: string,
  data: {
    paymentMethodHash: string;
    providerHashes: string[];
    currencies?: string[];
    timestampBuffer?: any; // Can be BigNumber or number
  }
): void {
  const providersDir = path.join(__dirname, "outputs", "platforms");
  if (!fs.existsSync(providersDir)) fs.mkdirSync(providersDir, { recursive: true });

  const filePath = path.join(providersDir, `${network}.json`);
  let current: any = { methods: {} };
  try {
    if (fs.existsSync(filePath)) {
      current = JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch { }

  const normalizeHex = (h: string) => (h.startsWith("0x") ? h.toLowerCase() : `0x${h.toLowerCase()}`);
  const hashes = Array.from(new Set((data.providerHashes || []).map(normalizeHex))).sort();

  // Convert BigNumber to number if needed
  let timestampBuffer = 30; // default
  if (data.timestampBuffer) {
    if (typeof data.timestampBuffer === 'object' && data.timestampBuffer._isBigNumber) {
      timestampBuffer = parseInt(data.timestampBuffer.toString());
    } else if (typeof data.timestampBuffer === 'number') {
      timestampBuffer = data.timestampBuffer;
    } else if (typeof data.timestampBuffer === 'string') {
      timestampBuffer = parseInt(data.timestampBuffer);
    }
  }

  current.methods[methodKey] = {
    paymentMethodHash: normalizeHex(data.paymentMethodHash),
    currencies: data.currencies || [],
    timestampBuffer,
    hashes,
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(filePath, JSON.stringify(current, null, 2));
}
