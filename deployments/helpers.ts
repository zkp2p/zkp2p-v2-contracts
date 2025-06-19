import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Address } from "../utils/types";
import { BigNumber } from "ethers";

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

export async function addWhitelistedPaymentVerifier(
  hre: HardhatRuntimeEnvironment,
  contract: any,
  newWhitelistedAddress: Address,
  feeShare: BigNumber
): Promise<void> {
  const currentOwner = await contract.owner();
  if (!(await contract.isWhitelistedVerifier(newWhitelistedAddress))) {
    if ((await hre.getUnnamedAccounts()).includes(currentOwner)) {
      const data = contract.interface.encodeFunctionData("addPaymentVerifier", [newWhitelistedAddress]);

      await hre.deployments.rawTx({
        from: currentOwner,
        to: contract.address,
        data
      });
    } else {
      console.log(
        `Contract owner is not in the list of accounts, must be manually added with the following calldata:
        ${contract.interface.encodeFunctionData("addPaymentVerifier", [newWhitelistedAddress])}
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