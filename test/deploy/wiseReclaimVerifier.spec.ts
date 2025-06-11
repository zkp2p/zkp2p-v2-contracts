import "module-alias/register";

import { deployments, ethers } from "hardhat";

import {
  WiseReclaimVerifier,
  NullifierRegistry,
  Escrow,
} from "../../utils/contracts";
import {
  WiseReclaimVerifier__factory,
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
  getWiseReclaimProviderHashes,
  WISE_RECLAIM_TIMESTAMP_BUFFER,
  WISE_RECLAIM_CURRENCIES,
  WISE_RECLAIM_FEE_SHARE,
  WISE_APPCLIP_PROVIDER_HASHES
} from "../../deployments/verifiers/wise_reclaim";

const expect = getWaffleExpect();

describe("WiseReclaimVerifier Deployment", () => {
  let deployer: Account;
  let multiSig: Address;
  let escrowAddress: string;

  let escrow: Escrow;
  let wiseReclaimVerifier: WiseReclaimVerifier;
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

    const wiseReclaimVerifierAddress = getDeployedContractAddress(network, "WiseReclaimVerifier");
    wiseReclaimVerifier = new WiseReclaimVerifier__factory(deployer.wallet).attach(wiseReclaimVerifierAddress);

    nullifierRegistry = new NullifierRegistry__factory(deployer.wallet).attach(nullifierRegistryAddress);
  });

  describe("Constructor", async () => {
    it("should set the correct parameters set", async () => {
      const actualOwner = await wiseReclaimVerifier.owner();
      const actualEscrowAddress = await wiseReclaimVerifier.escrow();
      const actualNullifierRegistryAddress = await wiseReclaimVerifier.nullifierRegistry();
      const actualProviderHashes = await wiseReclaimVerifier.getProviderHashes();
      const actualTimestampBuffer = await wiseReclaimVerifier.timestampBuffer();
      const actualCurrencies = await wiseReclaimVerifier.getCurrencies();
      const hashes = await getWiseReclaimProviderHashes(10);
      const appclipHashes = WISE_APPCLIP_PROVIDER_HASHES;
      const allHashes = [...hashes, ...appclipHashes];

      expect(actualOwner).to.eq(multiSig);
      expect(actualEscrowAddress).to.eq(escrowAddress);
      expect(actualNullifierRegistryAddress).to.eq(nullifierRegistry.address);
      expect([...actualProviderHashes].sort()).to.deep.eq([...allHashes].sort());
      expect([...actualCurrencies].sort()).to.deep.eq([...WISE_RECLAIM_CURRENCIES].sort());
      expect(actualTimestampBuffer).to.eq(WISE_RECLAIM_TIMESTAMP_BUFFER);
    });
  });

  describe("Write Permissions", async () => {
    it("should add write permissions to the NullifierRegistry", async () => {
      const hasWritePermission = await nullifierRegistry.isWriter(wiseReclaimVerifier.address);
      expect(hasWritePermission).to.be.true;
    });
  });

  // describe("Whitelisted Payment Verifier", async () => {
  //   it("should add the WiseReclaimVerifier to the whitelisted payment verifiers", async () => {
  //     const hasWritePermission = await escrow.whitelistedPaymentVerifiers(wiseReclaimVerifier.address);
  //     expect(hasWritePermission).to.be.true;
  //   });

  //   it("should set the correct fee share", async () => {
  //     const feeShare = await escrow.paymentVerifierFeeShare(wiseReclaimVerifier.address);
  //     expect(feeShare).to.eq(WISE_RECLAIM_FEE_SHARE[network]);
  //   });
  // });
});
