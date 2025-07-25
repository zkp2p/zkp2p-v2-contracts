import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Address } from "../utils/types";
import { BigNumber } from "ethers";
import { proposeSafeTransaction, SAFE_CONFIG } from './safeService';
import { MetaTransactionData } from '@safe-global/types-kit';

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

export async function addWhitelistedPaymentVerifier(
  hre: HardhatRuntimeEnvironment,
  contract: any,
  newWhitelistedAddress: Address,
  feeShare: BigNumber
): Promise<void> {
  const currentOwner = await contract.owner();
  if (!(await contract.whitelistedPaymentVerifiers(newWhitelistedAddress))) {
    if ((await hre.getUnnamedAccounts()).includes(currentOwner)) {
      const data = contract.interface.encodeFunctionData("addWhitelistedPaymentVerifier", [newWhitelistedAddress, feeShare]);

      await hre.deployments.rawTx({
        from: currentOwner,
        to: contract.address,
        data
      });
    } else {
      console.log(
        `Contract owner is not in the list of accounts, must be manually added with the following calldata:
        ${contract.interface.encodeFunctionData("addWhitelistedPaymentVerifier", [newWhitelistedAddress, feeShare])}
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

export interface ProviderHashOperation {
  contract: any;
  providerHash: string;
  operation: 'add' | 'remove';
}

export async function batchProviderHashOperations(
  hre: HardhatRuntimeEnvironment,
  operations: ProviderHashOperation[]
): Promise<void> {
  const network = hre.deployments.getNetworkName();

  if (network !== 'base' || !SAFE_CONFIG[network]) {
    throw new Error('Batch operations are only supported on base network');
  }

  const transactions: MetaTransactionData[] = [];
  const descriptions: string[] = [];

  for (const op of operations) {
    const data = op.operation === 'add'
      ? op.contract.interface.encodeFunctionData("addProviderHash", [op.providerHash])
      : op.contract.interface.encodeFunctionData("removeProviderHash", [op.providerHash]);

    // Validate operation
    const exists = await op.contract.isProviderHash(op.providerHash);
    if (op.operation === 'add' && exists) {
      console.log(`Skipping add: Provider hash ${op.providerHash} already exists`);
      continue;
    }
    if (op.operation === 'remove' && !exists) {
      console.log(`Skipping remove: Provider hash ${op.providerHash} not found`);
      continue;
    }

    transactions.push({
      to: op.contract.address,
      value: '0',
      data: data,
      operation: 0 // Call
    });

    descriptions.push(`${op.operation} ${op.providerHash} on ${op.contract.address}`);
  }

  if (transactions.length === 0) {
    console.log('No valid operations to batch');
    return;
  }

  console.log(`[SAFE] Preparing batch of ${transactions.length} operations:`);
  descriptions.forEach((desc, i) => console.log(`  ${i + 1}. ${desc}`));

  const [signer] = await hre.ethers.getSigners();

  try {
    const safeTxHash = await proposeSafeTransaction(signer, network, transactions);
    console.log(`[SAFE] Batch transaction proposed successfully`);
    console.log(`Safe transaction hash: ${safeTxHash}`);
    console.log(`View on Safe: https://app.safe.global/base:${SAFE_CONFIG[network].safeAddress}/transactions/tx?id=${safeTxHash}`);
  } catch (error) {
    console.error(`[SAFE] Error proposing batch transaction:`, error);
  }
}