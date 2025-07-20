import "module-alias/register";

import { deployments, ethers } from "hardhat";

import {
  PaypalReclaimVerifier,
  NullifierRegistry,
  Escrow,
} from "../../utils/contracts";
import {
  PaypalReclaimVerifier__factory,
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
  getPaypalReclaimProviderHashes,
  PAYPAL_RECLAIM_TIMESTAMP_BUFFER,
  PAYPAL_RECLAIM_CURRENCIES,
  PAYPAL_RECLAIM_FEE_SHARE,
} from "../../deployments/verifiers/paypal_reclaim";

const expect = getWaffleExpect();

describe("PaypalReclaimVerifier Deployment", () => {
  let deployer: Account;
  let multiSig: Address;
  let escrowAddress: string;

  let escrow: Escrow;
  let paypalReclaimVerifier: PaypalReclaimVerifier;
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

    const paypalReclaimVerifierAddress = getDeployedContractAddress(network, "PaypalReclaimVerifier");
    paypalReclaimVerifier = new PaypalReclaimVerifier__factory(deployer.wallet).attach(paypalReclaimVerifierAddress);

    nullifierRegistry = new NullifierRegistry__factory(deployer.wallet).attach(nullifierRegistryAddress);
  });

  describe("Constructor", async () => {
    it("should set the correct parameters set", async () => {
      const actualOwner = await paypalReclaimVerifier.owner();
      const actualEscrowAddress = await paypalReclaimVerifier.escrow();
      const actualNullifierRegistryAddress = await paypalReclaimVerifier.nullifierRegistry();
      const actualProviderHashes = await paypalReclaimVerifier.getProviderHashes();
      const actualTimestampBuffer = await paypalReclaimVerifier.timestampBuffer();
      const actualCurrencies = await paypalReclaimVerifier.getCurrencies();

      expect(actualOwner).to.eq(multiSig);
      expect(actualEscrowAddress).to.eq(escrowAddress);
      expect(actualNullifierRegistryAddress).to.eq(nullifierRegistry.address);
      const providerHashes = await getPaypalReclaimProviderHashes();
      expect(actualProviderHashes).to.deep.eq(providerHashes);
      expect(actualTimestampBuffer).to.eq(PAYPAL_RECLAIM_TIMESTAMP_BUFFER);
      expect(actualCurrencies).to.deep.eq(PAYPAL_RECLAIM_CURRENCIES);
    });
  });

  describe("Write Permissions", async () => {
    it("should add write permissions to the NullifierRegistry", async () => {
      const hasWritePermission = await nullifierRegistry.isWriter(paypalReclaimVerifier.address);
      expect(hasWritePermission).to.be.true;
    });
  });

  describe("Whitelisted Payment Verifier", async () => {
    it("should add the PaypalReclaimVerifier to the whitelisted payment verifiers", async () => {
      const hasWritePermission = await escrow.whitelistedPaymentVerifiers(paypalReclaimVerifier.address);
      expect(hasWritePermission).to.be.true;
    });

    it("should set the correct fee share", async () => {
      const feeShare = await escrow.paymentVerifierFeeShare(paypalReclaimVerifier.address);
      expect(feeShare).to.eq(PAYPAL_RECLAIM_FEE_SHARE[network]);
    });
  });
});