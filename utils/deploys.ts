import { BigNumber, Signer, ethers } from "ethers";

import { Address } from "@utils/types";

const circom = require("circomlibjs");

import {
  USDCMock,
  Escrow,
  ProtocolViewer,
  Orchestrator,
  PaymentVerifierMock,
  VenmoReclaimVerifier,
  RevolutReclaimVerifier,
  NullifierRegistry,
  BasePaymentVerifier,
  StringConversionUtilsMock,
  ClaimVerifierMock,
  ManagedKeyHashAdapterV2,
  BaseReclaimPaymentVerifier,
  CashappReclaimVerifier,
  WiseReclaimVerifier,
  MercadoPagoReclaimVerifier,
  ZelleBoAReclaimVerifier,
  ZelleCitiReclaimVerifier,
  ZelleChaseReclaimVerifier,
  ZelleBaseVerifier,
  BaseReclaimVerifier,
  PostIntentHookMock,
  PaymentVerifierRegistry,
  PostIntentHookRegistry,
  RelayerRegistry,
  OrchestratorMock,
  EscrowRegistry,
  BaseGenericPaymentVerifier,
  GenericVerifier
} from "./contracts";
import {
  StringConversionUtilsMock__factory,
  USDCMock__factory,
  PaymentVerifierMock__factory,
  ClaimVerifierMock__factory,
  PostIntentHookMock__factory,
  OrchestratorMock__factory
} from "../typechain/factories/contracts/mocks";
import { NullifierRegistry__factory } from "../typechain/factories/contracts/registries";
import { PaymentVerifierRegistry__factory } from "../typechain/factories/contracts/registries";
import { PostIntentHookRegistry__factory } from "../typechain/factories/contracts/registries";
import { RelayerRegistry__factory } from "../typechain/factories/contracts/registries";
import { EscrowRegistry__factory } from "../typechain/factories/contracts/registries";
import { BaseReclaimPaymentVerifier__factory, BaseReclaimVerifier__factory } from "../typechain/factories/contracts/verifiers/BaseVerifiers";
import { ManagedKeyHashAdapterV2__factory } from "../typechain/factories/contracts/verifiers/keyHashAdapters";
import { Escrow__factory } from "../typechain/factories/contracts/index";
import { ProtocolViewer__factory } from "../typechain/factories/contracts/index";
import { Orchestrator__factory } from "../typechain/factories/contracts/index";
import { VenmoReclaimVerifier__factory, ZelleBaseVerifier__factory } from "../typechain/factories/contracts/verifiers";
import { RevolutReclaimVerifier__factory } from "../typechain/factories/contracts/verifiers";
import { BasePaymentVerifier__factory } from "../typechain/factories/contracts/verifiers/BaseVerifiers";
import { CashappReclaimVerifier__factory } from "../typechain/factories/contracts/verifiers/CashappReclaimVerifeir.sol";
import { WiseReclaimVerifier__factory } from "../typechain/factories/contracts/verifiers";
import { MercadoPagoReclaimVerifier__factory } from "../typechain/factories/contracts/verifiers";
import { ZelleBoAReclaimVerifier__factory } from "../typechain/factories/contracts/verifiers/ZelleVerifiers";
import { ZelleCitiReclaimVerifier__factory } from "../typechain/factories/contracts/verifiers/ZelleVerifiers";
import { ZelleChaseReclaimVerifier__factory } from "../typechain/factories/contracts/verifiers/ZelleVerifiers";
import { BaseGenericPaymentVerifier__factory } from "../typechain/factories/contracts/verifiers/BaseVerifiers";
import { GenericVerifier__factory } from "../typechain/factories/contracts/verifiers";

export default class DeployHelper {
  private _deployerSigner: Signer;

  constructor(deployerSigner: Signer) {
    this._deployerSigner = deployerSigner;
  }

  public async deployUSDCMock(mintAmount: BigNumber, name: string, symbol: string): Promise<USDCMock> {
    return await new USDCMock__factory(this._deployerSigner).deploy(mintAmount.toString(), name, symbol);
  }

  public async deployEscrow(
    owner: Address,
    chainId: BigNumber,
    paymentVerifierRegistry: Address,
    makerProtocolFee: BigNumber,
    makerFeeRecipient: Address,
    dustThreshold: BigNumber,
    maxIntentsPerDeposit: BigNumber,
    intentExpirationPeriod: BigNumber
  ): Promise<Escrow> {
    return await new Escrow__factory(this._deployerSigner).deploy(
      owner,
      chainId.toString(),
      paymentVerifierRegistry,
      makerProtocolFee,
      makerFeeRecipient,
      dustThreshold,
      maxIntentsPerDeposit,
      intentExpirationPeriod
    );
  }

  public async deployOrchestrator(
    owner: Address,
    chainId: BigNumber,
    escrowRegistry: Address,
    paymentVerifierRegistry: Address,
    postIntentHookRegistry: Address,
    relayerRegistry: Address,
    protocolFee: BigNumber,
    protocolFeeRecipient: Address,
    partialManualReleaseDelay: BigNumber
  ): Promise<Orchestrator> {
    return await new Orchestrator__factory(this._deployerSigner).deploy(
      owner,
      chainId.toString(),
      escrowRegistry,
      paymentVerifierRegistry,
      postIntentHookRegistry,
      relayerRegistry,
      protocolFee,
      protocolFeeRecipient,
      partialManualReleaseDelay
    );
  }

  public async deployProtocolViewer(escrowAddress: Address, orchestratorAddress: Address): Promise<ProtocolViewer> {
    return await new ProtocolViewer__factory(this._deployerSigner).deploy(escrowAddress, orchestratorAddress);
  }

  public async deployBasePaymentVerifier(
    ramp: Address,
    nullifierRegistry: Address,
    timestampBuffer: BigNumber,
    currencies: string[]
  ): Promise<BasePaymentVerifier> {
    return await new BasePaymentVerifier__factory(this._deployerSigner).deploy(
      ramp,
      nullifierRegistry,
      timestampBuffer,
      currencies
    );
  }

  public async deployBaseReclaimPaymentVerifier(
    ramp: Address,
    nullifierRegistry: Address,
    timestampBuffer: BigNumber,
    currencies: string[],
    providerHashes: string[]
  ): Promise<BaseReclaimPaymentVerifier> {
    return await new BaseReclaimPaymentVerifier__factory(this._deployerSigner).deploy(
      ramp,
      nullifierRegistry,
      timestampBuffer,
      currencies,
      providerHashes
    );
  }

  public async deployBaseReclaimVerifier(
    providerHashes: string[]
  ): Promise<BaseReclaimVerifier> {
    return await new BaseReclaimVerifier__factory(this._deployerSigner).deploy(
      providerHashes
    );
  }


  public async deployVenmoReclaimVerifier(
    ramp: Address,
    nullifierRegistry: Address,
    timestampBuffer: BigNumber = BigNumber.from(30),
    currencies: string[],
    providerHashes: string[]
  ): Promise<VenmoReclaimVerifier> {
    return await new VenmoReclaimVerifier__factory(
      this._deployerSigner
    ).deploy(
      ramp,
      nullifierRegistry,
      timestampBuffer,
      currencies,
      providerHashes
    );
  }

  public async deployRevolutReclaimVerifier(
    ramp: Address,
    nullifierRegistry: Address,
    timestampBuffer: BigNumber,
    currencies: string[],
    providerHashes: string[]
  ): Promise<RevolutReclaimVerifier> {
    return await new RevolutReclaimVerifier__factory(
      this._deployerSigner
    ).deploy(
      ramp,
      nullifierRegistry,
      timestampBuffer,
      currencies,
      providerHashes
    );
  }

  public async deployMercadoPagoReclaimVerifier(
    ramp: Address,
    nullifierRegistry: Address,
    timestampBuffer: BigNumber,
    currencies: string[],
    providerHashes: string[]
  ): Promise<MercadoPagoReclaimVerifier> {
    return await new MercadoPagoReclaimVerifier__factory(
      this._deployerSigner
    ).deploy(
      ramp,
      nullifierRegistry,
      timestampBuffer,
      currencies,
      providerHashes
    );
  }

  public async deployCashappReclaimVerifier(
    ramp: Address,
    nullifierRegistry: Address,
    timestampBuffer: BigNumber,
    currencies: string[],
    providerHashes: string[]
  ): Promise<CashappReclaimVerifier> {
    return await new CashappReclaimVerifier__factory(
      this._deployerSigner
    ).deploy(
      ramp,
      nullifierRegistry,
      timestampBuffer,
      currencies,
      providerHashes
    );
  }

  public async deployWiseReclaimVerifier(
    ramp: Address,
    nullifierRegistry: Address,
    timestampBuffer: BigNumber,
    currencies: string[],
    providerHashes: string[]
  ): Promise<WiseReclaimVerifier> {
    return await new WiseReclaimVerifier__factory(this._deployerSigner).deploy(
      ramp,
      nullifierRegistry,
      timestampBuffer,
      currencies,
      providerHashes
    );
  }

  public async deployZelleBaseVerifier(
    ramp: Address,
    nullifierRegistry: Address,
    timestampBuffer: BigNumber,
    currencies: string[]
  ): Promise<ZelleBaseVerifier> {
    return await new ZelleBaseVerifier__factory(this._deployerSigner).deploy(
      ramp,
      nullifierRegistry,
      timestampBuffer,
      currencies
    );
  }

  public async deployZelleBoAReclaimVerifier(
    baseVerifier: Address,
    nullifierRegistry: Address,
    providerHashes: string[],
    timestampBuffer: BigNumber
  ): Promise<ZelleBoAReclaimVerifier> {
    return await new ZelleBoAReclaimVerifier__factory(this._deployerSigner).deploy(
      baseVerifier,
      nullifierRegistry,
      providerHashes,
      timestampBuffer
    );
  }

  public async deployZelleCitiReclaimVerifier(
    baseVerifier: Address,
    nullifierRegistry: Address,
    providerHashes: string[],
    timestampBuffer: BigNumber
  ): Promise<ZelleCitiReclaimVerifier> {
    return await new ZelleCitiReclaimVerifier__factory(this._deployerSigner).deploy(
      baseVerifier,
      nullifierRegistry,
      providerHashes,
      timestampBuffer
    );
  }

  public async deployZelleChaseReclaimVerifier(
    baseVerifier: Address,
    nullifierRegistry: Address,
    providerHashes: string[],
    timestampBuffer: BigNumber
  ): Promise<ZelleChaseReclaimVerifier> {
    return await new ZelleChaseReclaimVerifier__factory(this._deployerSigner).deploy(
      baseVerifier,
      nullifierRegistry,
      providerHashes,
      timestampBuffer
    );
  }

  public async deployNullifierRegistry(): Promise<NullifierRegistry> {
    return await new NullifierRegistry__factory(this._deployerSigner).deploy();
  }

  public async deployManagedKeyHashAdapterV2(keyHashes: string[]): Promise<ManagedKeyHashAdapterV2> {
    return await new ManagedKeyHashAdapterV2__factory(this._deployerSigner).deploy(keyHashes);
  }

  public async deployStringConversionUtilsMock(): Promise<StringConversionUtilsMock> {
    return await new StringConversionUtilsMock__factory(this._deployerSigner).deploy();
  }

  public async deployPaymentVerifierMock(
    ramp: Address,
    nullifierRegistry: Address,
    timestampBuffer: BigNumber,
    acceptedCurrencies: string[]
  ): Promise<PaymentVerifierMock> {
    return await new PaymentVerifierMock__factory(this._deployerSigner).deploy(
      ramp,
      nullifierRegistry,
      timestampBuffer,
      acceptedCurrencies
    );
  }

  public async deployClaimVerifierMock(): Promise<ClaimVerifierMock> {
    return await new ClaimVerifierMock__factory(this._deployerSigner).deploy();
  }

  public async deployPostIntentHookMock(
    usdc: Address,
    escrow: Address
  ): Promise<PostIntentHookMock> {
    return await new PostIntentHookMock__factory(this._deployerSigner).deploy(usdc, escrow);
  }

  public async deployOrchestratorMock(
    escrow: Address
  ): Promise<OrchestratorMock> {
    return await new OrchestratorMock__factory(this._deployerSigner).deploy(escrow);
  }

  public async deployPaymentVerifierRegistry(): Promise<PaymentVerifierRegistry> {
    return await new PaymentVerifierRegistry__factory(this._deployerSigner).deploy();
  }

  public async deployPostIntentHookRegistry(): Promise<PostIntentHookRegistry> {
    return await new PostIntentHookRegistry__factory(this._deployerSigner).deploy();
  }

  public async deployRelayerRegistry(): Promise<RelayerRegistry> {
    return await new RelayerRegistry__factory(this._deployerSigner).deploy();
  }

  public async deployEscrowRegistry(): Promise<EscrowRegistry> {
    return await new EscrowRegistry__factory(this._deployerSigner).deploy();
  }


  public async deployGenericVerifier(
    escrow: Address,
    nullifierRegistry: Address,
    minWitnessSignatures: BigNumber
  ): Promise<GenericVerifier> {
    return await new GenericVerifier__factory(this._deployerSigner).deploy(
      escrow,
      nullifierRegistry,
      minWitnessSignatures
    );
  }
}
