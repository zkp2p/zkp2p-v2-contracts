import "module-alias/register";

import { deployments, ethers } from "hardhat";

import {
  RevolutReclaimVerifier,
  NullifierRegistry,
  Escrow,
} from "../../utils/contracts";
import {
  RevolutReclaimVerifier__factory,
  NullifierRegistry__factory,
  Escrow__factory,
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
  MULTI_SIG,
} from "../../deployments/parameters";
import {
  REVOLUT_RECLAIM_PROVIDER_HASHES,
  REVOLUT_RECLAIM_TIMESTAMP_BUFFER,
  REVOLUT_RECLAIM_CURRENCIES
} from "../../deployments/verifiers/revolut_reclaim";

const expect = getWaffleExpect();

describe("RevolutReclaimVerifier Deployment", () => {
  let deployer: Account;
  let multiSig: Address;
  let escrowAddress: string;

  let escrow: Escrow;
  let revolutReclaimVerifier: RevolutReclaimVerifier;
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

    escrowAddress = getDeployedContractAddress(network, "Escrow");
    escrow = new Escrow__factory(deployer.wallet).attach(escrowAddress);

    const nullifierRegistryAddress = getDeployedContractAddress(network, "NullifierRegistry");
    const claimVerifierAddress = getDeployedContractAddress(network, "ClaimVerifier");

    const revolutReclaimVerifierAddress = getDeployedContractAddress(network, "RevolutReclaimVerifier");
    revolutReclaimVerifier = new RevolutReclaimVerifier__factory(
      {
        "contracts/lib/ClaimVerifier.sol:ClaimVerifier": claimVerifierAddress,
      },
      deployer.wallet,
    ).attach(revolutReclaimVerifierAddress);

    nullifierRegistry = new NullifierRegistry__factory(deployer.wallet).attach(nullifierRegistryAddress);
  });

  describe("Constructor", async () => {
    it("should set the correct parameters set", async () => {
      const actualOwner = await revolutReclaimVerifier.owner();
      const actualEscrowAddress = await revolutReclaimVerifier.escrow();
      const actualNullifierRegistryAddress = await revolutReclaimVerifier.nullifierRegistry();
      const actualProviderHashes = await revolutReclaimVerifier.getProviderHashes();
      const actualTimestampBuffer = await revolutReclaimVerifier.timestampBuffer();
      const actualCurrencies = await revolutReclaimVerifier.getCurrencies();

      expect(actualOwner).to.eq(multiSig);
      expect(actualEscrowAddress).to.eq(escrowAddress);
      expect(actualNullifierRegistryAddress).to.eq(nullifierRegistry.address);
      expect(actualProviderHashes).to.deep.eq(REVOLUT_RECLAIM_PROVIDER_HASHES);
      expect(actualTimestampBuffer).to.eq(REVOLUT_RECLAIM_TIMESTAMP_BUFFER);
      expect(actualCurrencies).to.deep.eq(REVOLUT_RECLAIM_CURRENCIES);
    });
  });

  describe("Write Permissions", async () => {
    it("should add write permissions to the NullifierRegistry", async () => {
      const hasWritePermission = await nullifierRegistry.isWriter(revolutReclaimVerifier.address);
      expect(hasWritePermission).to.be.true;
    });
  });

  describe("Whitelisted Payment Verifier", async () => {
    it("should add the RevolutReclaimVerifier to the whitelisted payment verifiers", async () => {
      const hasWritePermission = await escrow.whitelistedPaymentVerifiers(revolutReclaimVerifier.address);
      expect(hasWritePermission).to.be.true;
    });
  });
});