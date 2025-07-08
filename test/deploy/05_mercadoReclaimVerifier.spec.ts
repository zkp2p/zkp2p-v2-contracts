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
  PaymentVerifierRegistry,
  PaymentVerifierRegistry__factory,
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
} from "../../deployments/verifiers/mercado_pago_reclaim";

const expect = getWaffleExpect();

describe("MercadoPagoReclaimVerifier Deployment", () => {
  let deployer: Account;
  let multiSig: Address;
  let escrowAddress: string;

  let escrow: Escrow;
  let mercadoPagoReclaimVerifier: MercadoPagoReclaimVerifier;
  let nullifierRegistry: NullifierRegistry;
  let paymentVerifierRegistry: PaymentVerifierRegistry;

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

    const paymentVerifierRegistryAddress = getDeployedContractAddress(network, "PaymentVerifierRegistry");
    paymentVerifierRegistry = new PaymentVerifierRegistry__factory(deployer.wallet).attach(paymentVerifierRegistryAddress);

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

      expect(actualOwner).to.eq(multiSig);
      expect(actualEscrowAddress).to.eq(escrowAddress);
      expect(actualNullifierRegistryAddress).to.eq(nullifierRegistry.address);
      expect([...actualProviderHashes].sort()).to.deep.eq([...hashes].sort());
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

  describe("Payment Verifier Registry", async () => {
    it("should add the MercadoPagoReclaimVerifier to the payment verifier registry", async () => {
      const isWhitelisted = await paymentVerifierRegistry.isWhitelistedVerifier(mercadoPagoReclaimVerifier.address);
      expect(isWhitelisted).to.be.true;
    });
  });
});
