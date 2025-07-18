import { BigNumber, Signer, ethers } from "ethers";

import { Address } from "@utils/types";

const circom = require("circomlibjs");

import {
  USDCMock,
  Escrow,
  PaymentVerifierMock,
  VenmoReclaimVerifier,
  RevolutReclaimVerifier,
  NullifierRegistry,
  BasePaymentVerifier,
  StringConversionUtilsMock,
  ClaimVerifierMock,
  Quoter,
  ManagedKeyHashAdapterV2,
  BaseReclaimPaymentVerifier,
  CashappReclaimVerifier,
  WiseReclaimVerifier,
  PaypalReclaimVerifier,
  MercadoPagoReclaimVerifier,
  ZelleBoAReclaimVerifier,
  ZelleCitiReclaimVerifier,
  ZelleChaseReclaimVerifier,
  ZelleBaseVerifier,
  BaseReclaimVerifier
} from "./contracts";
import {
  StringConversionUtilsMock__factory,
  USDCMock__factory,
  PaymentVerifierMock__factory,
  ClaimVerifierMock__factory
} from "../typechain/factories/contracts/mocks";
import { NullifierRegistry__factory } from "../typechain/factories/contracts/verifiers/nullifierRegistries";
import { BaseReclaimPaymentVerifier__factory, BaseReclaimVerifier__factory } from "../typechain/factories/contracts/verifiers/BaseVerifiers";
import { ManagedKeyHashAdapterV2__factory } from "../typechain/factories/contracts/verifiers/keyHashAdapters";
import { Quoter__factory } from "../typechain/factories/contracts/periphery"
import { Escrow__factory } from "../typechain/factories/contracts/index";
import { VenmoReclaimVerifier__factory, ZelleBaseVerifier__factory } from "../typechain/factories/contracts/verifiers";
import { RevolutReclaimVerifier__factory } from "../typechain/factories/contracts/verifiers";
import { BasePaymentVerifier__factory } from "../typechain/factories/contracts/verifiers/BaseVerifiers";
import { CashappReclaimVerifier__factory } from "../typechain/factories/contracts/verifiers/CashappReclaimVerifeir.sol";
import { WiseReclaimVerifier__factory } from "../typechain/factories/contracts/verifiers";
import { PaypalReclaimVerifier__factory } from "../typechain/factories/contracts/verifiers";
import { MercadoPagoReclaimVerifier__factory } from "../typechain/factories/contracts/verifiers";
import { ZelleBoAReclaimVerifier__factory } from "../typechain/factories/contracts/verifiers/ZelleVerifiers";
import { ZelleCitiReclaimVerifier__factory } from "../typechain/factories/contracts/verifiers/ZelleVerifiers";
import { ZelleChaseReclaimVerifier__factory } from "../typechain/factories/contracts/verifiers/ZelleVerifiers";

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
    intentExpirationPeriod: BigNumber,
    sustainabilityFee: BigNumber,
    sustainabilityFeeRecipient: Address,
    chainId: BigNumber
  ): Promise<Escrow> {
    return await new Escrow__factory(this._deployerSigner).deploy(
      owner,
      chainId.toString(),
      intentExpirationPeriod,
      sustainabilityFee,
      sustainabilityFeeRecipient
    );
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

  public async deployPaypalReclaimVerifier(
    ramp: Address,
    nullifierRegistry: Address,
    timestampBuffer: BigNumber,
    currencies: string[],
    providerHashes: string[]
  ): Promise<PaypalReclaimVerifier> {
    return await new PaypalReclaimVerifier__factory(this._deployerSigner).deploy(
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

  public async deployQuoter(escrow: Address): Promise<Quoter> {
    return await new Quoter__factory(this._deployerSigner).deploy(escrow);
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
}
