import "module-alias/register";

import { deployments, ethers } from "hardhat";

import {
  VenmoReclaimVerifier,
  NullifierRegistry,
} from "../../utils/contracts";
import {
  VenmoReclaimVerifier__factory,
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
  TIMESTAMP_BUFFER,
  MULTI_SIG,
} from "../../deployments/parameters";
import { PaymentService } from "../../utils/types";
import { VENMO_RECLAIM_PROVIDER_HASHES } from "../../deployments/providerHashes/venmo_reclaim";

const expect = getWaffleExpect();

describe("VenmoReclaimVerifier Deployment", () => {
  let deployer: Account;
  let multiSig: Address;
  let escrowAddress: string;

  let venmoReclaimVerifier: VenmoReclaimVerifier;
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
    const nullifierRegistryAddress = getDeployedContractAddress(network, "NullifierRegistry");
    const claimVerifierAddress = getDeployedContractAddress(network, "ClaimVerifier");

    const venmoReclaimVerifierAddress = getDeployedContractAddress(network, "VenmoReclaimVerifier");
    venmoReclaimVerifier = new VenmoReclaimVerifier__factory(
      {
        "contracts/lib/ClaimVerifier.sol:ClaimVerifier": claimVerifierAddress,
      },
      deployer.wallet,
    ).attach(venmoReclaimVerifierAddress);

    nullifierRegistry = new NullifierRegistry__factory(deployer.wallet).attach(nullifierRegistryAddress);
  });

  describe("Constructor", async () => {
    it("should set the correct parameters set", async () => {
      const actualOwner = await venmoReclaimVerifier.owner();
      const actualEscrowAddress = await venmoReclaimVerifier.escrow();
      const actualNullifierRegistryAddress = await venmoReclaimVerifier.nullifierRegistry();
      const actualProviderHashes = await venmoReclaimVerifier.getProviderHashes();
      const actualTimestampBuffer = await venmoReclaimVerifier.timestampBuffer();

      expect(actualOwner).to.eq(multiSig);
      expect(actualEscrowAddress).to.eq(escrowAddress);
      expect(actualNullifierRegistryAddress).to.eq(nullifierRegistry.address);
      expect(actualProviderHashes).to.deep.eq(VENMO_RECLAIM_PROVIDER_HASHES);
      expect(actualTimestampBuffer).to.eq(TIMESTAMP_BUFFER[PaymentService.VenmoReclaim]);
    });
  });

  describe("Write Permissions", async () => {
    it("should add write permissions to the NullifierRegistry", async () => {
      const hasWritePermission = await nullifierRegistry.isWriter(venmoReclaimVerifier.address);
      expect(hasWritePermission).to.be.true;
    });
  });
});
