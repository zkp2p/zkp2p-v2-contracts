import "module-alias/register";

import { deployments, ethers } from "hardhat";

import {
  Escrow,
  NullifierRegistry,
} from "../../utils/contracts";
import {
  Escrow__factory,
  NullifierRegistry__factory,
  Orchestrator__factory,
  PaymentVerifierRegistry,
  PaymentVerifierRegistry__factory,
  PostIntentHookRegistry,
  PostIntentHookRegistry__factory,
  ProtocolViewer,
  ProtocolViewer__factory,
  RelayerRegistry,
  RelayerRegistry__factory,
  Orchestrator,
  EscrowRegistry__factory,
  EscrowRegistry
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
  PROTOCOL_TAKER_FEE,
  PROTOCOL_TAKER_FEE_RECIPIENT,
  MULTI_SIG,
  DUST_RECIPIENT,
  DUST_THRESHOLD,
  MAX_INTENTS_PER_DEPOSIT
} from "../../deployments/parameters";

const expect = getWaffleExpect();

describe("V2.1 System Deployment", () => {
  let deployer: Account;
  let multiSig: Address;

  let escrow: Escrow;
  let orchestrator: Orchestrator;
  let nullifierRegistry: NullifierRegistry;
  let paymentVerifierRegistry: PaymentVerifierRegistry;
  let postIntentHookRegistry: PostIntentHookRegistry;
  let relayerRegistry: RelayerRegistry;
  let protocolViewer: ProtocolViewer;
  let escrowRegistry: EscrowRegistry;

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

    const orchestratorAddress = await getDeployedContractAddress(network, "Orchestrator");
    orchestrator = new Orchestrator__factory(deployer.wallet).attach(orchestratorAddress);

    const paymentVerifierRegistryAddress = await getDeployedContractAddress(network, "PaymentVerifierRegistry");
    paymentVerifierRegistry = new PaymentVerifierRegistry__factory(deployer.wallet).attach(paymentVerifierRegistryAddress);

    const postIntentHookRegistryAddress = await getDeployedContractAddress(network, "PostIntentHookRegistry");
    postIntentHookRegistry = new PostIntentHookRegistry__factory(deployer.wallet).attach(postIntentHookRegistryAddress);

    const relayerRegistryAddress = await getDeployedContractAddress(network, "RelayerRegistry");
    relayerRegistry = new RelayerRegistry__factory(deployer.wallet).attach(relayerRegistryAddress);

    const nullifierRegistryAddress = await getDeployedContractAddress(network, "NullifierRegistry");
    nullifierRegistry = new NullifierRegistry__factory(deployer.wallet).attach(nullifierRegistryAddress);

    const escrowRegistryAddress = await getDeployedContractAddress(network, "EscrowRegistry");
    escrowRegistry = new EscrowRegistry__factory(deployer.wallet).attach(escrowRegistryAddress);

    const protocolViewerAddress = await getDeployedContractAddress(network, "ProtocolViewer");
    protocolViewer = new ProtocolViewer__factory(deployer.wallet).attach(protocolViewerAddress);
  });

  describe("EscrowRegistry", async () => {
    it("should have the correct owner", async () => {
      const actualOwner = await escrowRegistry.owner();
      expect(actualOwner).to.eq(multiSig);
    });
  });

  describe("Escrow", async () => {
    it("should have the correct owner", async () => {
      const actualOwner = await escrow.owner();
      expect(actualOwner).to.eq(multiSig);
    });

    it("should have the payment verifier registry set", async () => {
      const actualPaymentVerifierRegistry = await escrow.paymentVerifierRegistry();
      expect(actualPaymentVerifierRegistry).to.eq(paymentVerifierRegistry.address);
    });

    it("should have the correct orchestrator set", async () => {
      const actualOrchestrator = await escrow.orchestrator();
      expect(actualOrchestrator).to.eq(orchestrator.address);
    });

    it("should have the correct chain id set", async () => {
      const actualChainId = await escrow.chainId();
      expect(actualChainId).to.eq((await ethers.provider.getNetwork()).chainId);
    });

    it("should have the escrow whitelisted", async () => {
      const isWhitelisted = await escrowRegistry.isWhitelistedEscrow(escrow.address);
      expect(isWhitelisted).to.eq(true);
    });

    it("should have the correct dust recipient set", async () => {
      const actualDustRecipient = await escrow.dustRecipient();

      const expectedDustRecipient = DUST_RECIPIENT[network] != ""
        ? DUST_RECIPIENT[network]
        : deployer.address;

      expect(actualDustRecipient).to.eq(expectedDustRecipient);
    });

    it("should have the correct dust threshold set", async () => {
      const actualDustThreshold = await escrow.dustThreshold();
      expect(actualDustThreshold).to.eq(DUST_THRESHOLD[network]);
    });

    it("should have the correct max intents per deposit set", async () => {
      const actualMaxIntentsPerDeposit = await escrow.maxIntentsPerDeposit();
      expect(actualMaxIntentsPerDeposit).to.eq(MAX_INTENTS_PER_DEPOSIT[network]);
    });

    it("should have the correct intent expiration period set", async () => {
      const actualIntentExpirationPeriod = await escrow.intentExpirationPeriod();
      expect(actualIntentExpirationPeriod).to.eq(INTENT_EXPIRATION_PERIOD[network]);
    });
  });

  describe("Orchestrator", async () => {
    it("should have the correct protocol fee and recipient set", async () => {
      const actualProtocolFee = await orchestrator.protocolFee();
      const actualProtocolFeeRecipient = await orchestrator.protocolFeeRecipient();
      const actualOwner = await orchestrator.owner();
      const actualChainId = await orchestrator.chainId();

      const expectedProtocolFeeRecipient = PROTOCOL_TAKER_FEE_RECIPIENT[network] != ""
        ? PROTOCOL_TAKER_FEE_RECIPIENT[network]
        : deployer.address;

      expect(actualProtocolFee).to.eq(PROTOCOL_TAKER_FEE[network]);
      expect(actualProtocolFeeRecipient).to.eq(expectedProtocolFeeRecipient);
      expect(actualOwner).to.eq(multiSig);
      expect(actualChainId).to.eq((await ethers.provider.getNetwork()).chainId);
    });

    it("should have the correct post intent hook registry set", async () => {
      const actualPostIntentHookRegistry = await orchestrator.postIntentHookRegistry();
      expect(actualPostIntentHookRegistry).to.eq(postIntentHookRegistry.address);
    });

    it("should have the correct relayer registry set", async () => {
      const actualRelayerRegistry = await orchestrator.relayerRegistry();
      expect(actualRelayerRegistry).to.eq(relayerRegistry.address);
    });

    it("should have the correct escrow registry set", async () => {
      const actualEscrowRegistry = await orchestrator.escrowRegistry();
      expect(actualEscrowRegistry).to.eq(escrowRegistry.address);
    });
  });

  describe("NullifierRegistry", async () => {
    it("should have the correct owner", async () => {
      const actualOwner = await nullifierRegistry.owner();
      expect(actualOwner).to.eq(multiSig);
    });
  });

  describe("PaymentVerifierRegistry", async () => {
    it("should have the correct owner", async () => {
      const actualOwner = await paymentVerifierRegistry.owner();
      expect(actualOwner).to.eq(multiSig);
    });
  });

  describe("PostIntentHookRegistry", async () => {
    it("should have the correct owner", async () => {
      const actualOwner = await postIntentHookRegistry.owner();
      expect(actualOwner).to.eq(multiSig);
    });
  });

  describe("RelayerRegistry", async () => {
    it("should have the correct owner", async () => {
      const actualOwner = await relayerRegistry.owner();
      expect(actualOwner).to.eq(multiSig);
    });
  });

  describe("ProtocolViewer", async () => {
    it("should have the correct escrow and orchestrator set", async () => {
      const actualEscrow = await protocolViewer.escrowContract();
      const actualOrchestrator = await protocolViewer.orchestrator();
      expect(actualEscrow).to.eq(escrow.address);
      expect(actualOrchestrator).to.eq(orchestrator.address);
    });
  });
});
