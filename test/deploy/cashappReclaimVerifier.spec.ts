import "module-alias/register";

import { deployments, ethers } from "hardhat";

import {
  CashappReclaimVerifier,
  NullifierRegistry,
  Escrow,
} from "../../utils/contracts";
import {
  CashappReclaimVerifier__factory,
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
  CASHAPP_RECLAIM_PROVIDER_HASHES,
  CASHAPP_RECLAIM_TIMESTAMP_BUFFER,
  CASHAPP_RECLAIM_CURRENCIES,
  CASHAPP_RECLAIM_FEE_SHARE
} from "../../deployments/verifiers/cashapp_reclaim";

const expect = getWaffleExpect();

describe("CashAppReclaimVerifier Deployment", () => {
  let deployer: Account;
  let multiSig: Address;
  let escrowAddress: string;

  let escrow: Escrow;
  let cashappReclaimVerifier: CashappReclaimVerifier;
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

    const cashappReclaimVerifierAddress = getDeployedContractAddress(network, "CashAppReclaimVerifier");
    cashappReclaimVerifier = new CashappReclaimVerifier__factory(
      {
        "contracts/lib/ClaimVerifier.sol:ClaimVerifier": claimVerifierAddress,
      },
      deployer.wallet,
    ).attach(cashappReclaimVerifierAddress);

    nullifierRegistry = new NullifierRegistry__factory(deployer.wallet).attach(nullifierRegistryAddress);
  });

  describe("Constructor", async () => {
    it("should set the correct parameters set", async () => {
      const actualOwner = await cashappReclaimVerifier.owner();
      const actualEscrowAddress = await cashappReclaimVerifier.escrow();
      const actualNullifierRegistryAddress = await cashappReclaimVerifier.nullifierRegistry();
      const actualProviderHashes = await cashappReclaimVerifier.getProviderHashes();
      const actualTimestampBuffer = await cashappReclaimVerifier.timestampBuffer();
      const actualCurrencies = await cashappReclaimVerifier.getCurrencies();

      expect(actualOwner).to.eq(multiSig);
      expect(actualEscrowAddress).to.eq(escrowAddress);
      expect(actualNullifierRegistryAddress).to.eq(nullifierRegistry.address);
      expect(actualProviderHashes).to.deep.eq(CASHAPP_RECLAIM_PROVIDER_HASHES);
      expect(actualTimestampBuffer).to.eq(CASHAPP_RECLAIM_TIMESTAMP_BUFFER);
      expect(actualCurrencies).to.deep.eq(CASHAPP_RECLAIM_CURRENCIES);
    });
  });

  describe("Write Permissions", async () => {
    it("should add write permissions to the NullifierRegistry", async () => {
      const hasWritePermission = await nullifierRegistry.isWriter(cashappReclaimVerifier.address);
      expect(hasWritePermission).to.be.true;
    });
  });

  describe("Whitelisted Payment Verifier", async () => {
    it("should add the CashAppReclaimVerifier to the whitelisted payment verifiers", async () => {
      const hasWritePermission = await escrow.whitelistedPaymentVerifiers(cashappReclaimVerifier.address);
      expect(hasWritePermission).to.be.true;
    });

    it("should set the correct fee share", async () => {
      const feeShare = await escrow.paymentVerifierFeeShare(cashappReclaimVerifier.address);
      expect(feeShare).to.eq(CASHAPP_RECLAIM_FEE_SHARE);
    });
  });
});
