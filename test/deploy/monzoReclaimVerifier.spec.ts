import "module-alias/register";

import { deployments, ethers } from "hardhat";

import {
  MonzoReclaimVerifier,
  NullifierRegistry,
  Escrow,
} from "../../utils/contracts";
import {
  MonzoReclaimVerifier__factory,
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
  getMonzoReclaimProviderHashes,
  MONZO_RECLAIM_TIMESTAMP_BUFFER,
  MONZO_RECLAIM_CURRENCIES,
  MONZO_RECLAIM_FEE_SHARE,
} from "../../deployments/verifiers/monzo_reclaim";

const expect = getWaffleExpect();

describe("MonzoReclaimVerifier Deployment", () => {
  let deployer: Account;
  let multiSig: Address;
  let escrowAddress: string;

  let escrow: Escrow;
  let monzoReclaimVerifier: MonzoReclaimVerifier;
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

    const monzoReclaimVerifierAddress = getDeployedContractAddress(network, "MonzoReclaimVerifier");
    monzoReclaimVerifier = new MonzoReclaimVerifier__factory(deployer.wallet).attach(monzoReclaimVerifierAddress);

    nullifierRegistry = new NullifierRegistry__factory(deployer.wallet).attach(nullifierRegistryAddress);
  });

  describe("Constructor", async () => {
    it("should set the correct parameters set", async () => {
      const actualOwner = await monzoReclaimVerifier.owner();
      const actualEscrowAddress = await monzoReclaimVerifier.escrow();
      const actualNullifierRegistryAddress = await monzoReclaimVerifier.nullifierRegistry();
      const actualProviderHashes = await monzoReclaimVerifier.getProviderHashes();
      const actualTimestampBuffer = await monzoReclaimVerifier.timestampBuffer();
      const actualCurrencies = await monzoReclaimVerifier.getCurrencies();

      expect(actualOwner).to.eq(multiSig);
      expect(actualEscrowAddress).to.eq(escrowAddress);
      expect(actualNullifierRegistryAddress).to.eq(nullifierRegistry.address);
      const providerHashes = await getMonzoReclaimProviderHashes();
      expect(actualProviderHashes).to.deep.eq(providerHashes);
      expect(actualTimestampBuffer).to.eq(MONZO_RECLAIM_TIMESTAMP_BUFFER);
      expect(actualCurrencies).to.deep.eq(MONZO_RECLAIM_CURRENCIES);
    });
  });

  describe("Write Permissions", async () => {
    it("should add write permissions to the NullifierRegistry", async () => {
      const hasWritePermission = await nullifierRegistry.isWriter(monzoReclaimVerifier.address);
      expect(hasWritePermission).to.be.true;
    });
  });

  describe("Whitelisted Payment Verifier", async () => {
    it("should add the MonzoReclaimVerifier to the whitelisted payment verifiers", async () => {
      const hasWritePermission = await escrow.whitelistedPaymentVerifiers(monzoReclaimVerifier.address);
      expect(hasWritePermission).to.be.true;
    });

    it("should set the correct fee share", async () => {
      const feeShare = await escrow.paymentVerifierFeeShare(monzoReclaimVerifier.address);
      expect(feeShare).to.eq(MONZO_RECLAIM_FEE_SHARE[network]);
    });
  });
});