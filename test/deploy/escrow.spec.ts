import "module-alias/register";

import { deployments, ethers } from "hardhat";

import {
  Escrow,
  NullifierRegistry,
} from "../../utils/contracts";
import {
  Escrow__factory,
  NullifierRegistry__factory,
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

import {
  INTENT_EXPIRATION_PERIOD,
  SUSTAINABILITY_FEE,
  SUSTAINABILITY_FEE_RECIPIENT,
  MULTI_SIG,
} from "../../deployments/parameters";

const expect = getWaffleExpect();

describe("Escrow and NullifierRegistry Deployment", () => {
  let deployer: Account;
  let multiSig: Address;

  let escrow: Escrow;
  let nullifierRegistry: NullifierRegistry;

  const network: string = deployments.getNetworkName();

  function getDeployedContractAddress(network: string, contractName: string): string {
    return require(`../../deployments/${network}/${contractName}.json`).address;
  }

  before(async () => {
    [
      deployer,
    ] = await getAccounts();

    multiSig = MULTI_SIG[network] ? MULTI_SIG[network] : deployer.address;

    const escrowAddress = await getDeployedContractAddress(network, "Escrow");
    escrow = new Escrow__factory(deployer.wallet).attach(escrowAddress);

    const nullifierRegistryAddress = await getDeployedContractAddress(network, "NullifierRegistry");
    nullifierRegistry = new NullifierRegistry__factory(deployer.wallet).attach(nullifierRegistryAddress);
  });

  describe("Escrow", async () => {
    it("should have the correct sustainability fee and recipient set", async () => {
      const actualSustainabilityFee = await escrow.sustainabilityFee();
      const actualSustainabilityFeeRecipient = await escrow.sustainabilityFeeRecipient();
      const actualOwner = await escrow.owner();

      const expectedSustainabilityFeeRecipient = SUSTAINABILITY_FEE_RECIPIENT[network] != ""
        ? SUSTAINABILITY_FEE_RECIPIENT[network]
        : deployer.address;

      expect(actualSustainabilityFee).to.eq(SUSTAINABILITY_FEE[network]);
      expect(actualSustainabilityFeeRecipient).to.eq(expectedSustainabilityFeeRecipient);
      expect(actualOwner).to.eq(multiSig);
    });

    it("should have the correct intent expiration period set", async () => {
      const actualIntentExpirationPeriod = await escrow.intentExpirationPeriod();
      expect(actualIntentExpirationPeriod).to.eq(INTENT_EXPIRATION_PERIOD[network]);
    });
  });

  describe("NullifierRegistry", async () => {
    it("should have the correct owner", async () => {
      const actualOwner = await nullifierRegistry.owner();
      expect(actualOwner).to.eq(multiSig);
    });
  });
});
