import "module-alias/register";

import { deployments, ethers } from "hardhat";

import {
  Quoter,
} from "../../utils/contracts";
import {
  Quoter__factory,
} from "../../typechain";

import {
  getAccounts,
  getWaffleExpect,
} from "../../utils/test";
import {
  Account
} from "../../utils/test/types";
import {
  Address
} from "../../utils/types";

const expect = getWaffleExpect();


// Skip as we don't need to deploy this contract
describe.skip("Quoter Deployment", () => {
  let deployer: Account;

  let quoter: Quoter;
  let escrowAddress: Address;

  const network: string = deployments.getNetworkName();

  function getDeployedContractAddress(network: string, contractName: string): string {
    return require(`../../deployments/${network}/${contractName}.json`).address;
  }

  before(async () => {
    [
      deployer,
    ] = await getAccounts();

    escrowAddress = await getDeployedContractAddress(network, "Escrow");
    const quoterAddress = await getDeployedContractAddress(network, "Quoter");
    quoter = new Quoter__factory(deployer.wallet).attach(quoterAddress);
  });

  describe("Quoter", async () => {
    it("should have the correct escrow address set", async () => {
      const actualEscrowAddress = await quoter.escrow();
      expect(actualEscrowAddress).to.eq(escrowAddress);
    });
  });
});
