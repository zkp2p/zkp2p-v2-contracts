import "module-alias/register";

import { deployments, ethers } from "hardhat";

import {
  MercadoPagoReclaimVerifier,
  NullifierRegistry,
  Escrow,
} from "../../utils/contracts";
import {
  MercadoPagoReclaimVerifier__factory,
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
  getMercadoReclaimProviderHashes,
  MERCADO_RECLAIM_TIMESTAMP_BUFFER,
  MERCADO_RECLAIM_CURRENCIES,
  MERCADO_RECLAIM_FEE_SHARE,
  MERCADO_APPCLIP_PROVIDER_HASHES
} from "../../deployments/verifiers/mercado_pago_reclaim";

const expect = getWaffleExpect();

describe("MercadoPagoReclaimVerifier Deployment", () => {
  let deployer: Account;
  let multiSig: Address;
  let escrowAddress: string;

  let escrow: Escrow;
  let mercadoPagoReclaimVerifier: MercadoPagoReclaimVerifier;
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

    const mercadoPagoReclaimVerifierAddress = getDeployedContractAddress(network, "MercadoPagoReclaimVerifier");
    mercadoPagoReclaimVerifier = new MercadoPagoReclaimVerifier__factory(deployer.wallet).attach(mercadoPagoReclaimVerifierAddress);

    nullifierRegistry = new NullifierRegistry__factory(deployer.wallet).attach(nullifierRegistryAddress);
  });

  describe("Constructor", async () => {
    it("should set the correct parameters set", async () => {
      const actualOwner = await mercadoPagoReclaimVerifier.owner();
      const actualEscrowAddress = await mercadoPagoReclaimVerifier.escrow();
      const actualNullifierRegistryAddress = await mercadoPagoReclaimVerifier.nullifierRegistry();
      const actualProviderHashes = await mercadoPagoReclaimVerifier.getProviderHashes();
      const actualTimestampBuffer = await mercadoPagoReclaimVerifier.timestampBuffer();
      const actualCurrencies = await mercadoPagoReclaimVerifier.getCurrencies();
      const hashes = await getMercadoReclaimProviderHashes(1);
      const appclipHashes = MERCADO_APPCLIP_PROVIDER_HASHES;
      const allHashes = [...hashes, ...appclipHashes];

      expect(actualOwner).to.eq(multiSig);
      expect(actualEscrowAddress).to.eq(escrowAddress);
      expect(actualNullifierRegistryAddress).to.eq(nullifierRegistry.address);
      expect([...actualProviderHashes].sort()).to.deep.eq([...allHashes].sort());
      expect([...actualCurrencies].sort()).to.deep.eq([...MERCADO_RECLAIM_CURRENCIES].sort());
      expect(actualTimestampBuffer).to.eq(MERCADO_RECLAIM_TIMESTAMP_BUFFER);
    });
  });

  describe("Write Permissions", async () => {
    it("should add write permissions to the NullifierRegistry", async () => {
      const hasWritePermission = await nullifierRegistry.isWriter(mercadoPagoReclaimVerifier.address);
      expect(hasWritePermission).to.be.true;
    });
  });

  describe("Whitelisted Payment Verifier", async () => {
    it("should add the MercadoPagoReclaimVerifier to the whitelisted payment verifiers", async () => {
      const hasWritePermission = await escrow.whitelistedPaymentVerifiers(mercadoPagoReclaimVerifier.address);
      expect(hasWritePermission).to.be.true;
    });

    it("should set the correct fee share", async () => {
      const feeShare = await escrow.paymentVerifierFeeShare(mercadoPagoReclaimVerifier.address);
      expect(feeShare).to.eq(MERCADO_RECLAIM_FEE_SHARE[network]);
    });
  });
});
