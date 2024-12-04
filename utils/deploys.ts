import { BigNumber, Signer, ethers } from "ethers";

import { Address } from "@utils/types";

const circom = require("circomlibjs");

import {
  USDCMock,
  Escrow,
  PaymentVerifierMock,
  VenmoReclaimVerifier,
  NullifierRegistry,
  BasePaymentVerifier,
  StringConversionUtilsMock,
  ClaimVerifierMock,
  Quoter
} from "./contracts";
import {
  StringConversionUtilsMock__factory,
  USDCMock__factory,
  PaymentVerifierMock__factory,
  ClaimVerifierMock__factory
} from "../typechain/factories/contracts/mocks";
import { NullifierRegistry__factory } from "../typechain/factories/contracts/verifiers/nullifierRegistries";
import {
  ClaimVerifier__factory,
} from "../typechain/factories/contracts/lib";
import { Quoter__factory } from "../typechain/factories/contracts/periphery";
import { ClaimVerifier } from "@typechain/contracts/lib/ClaimVerifier";
import { Escrow__factory } from "../typechain/factories/contracts/index";
import { VenmoReclaimVerifier__factory } from "../typechain/factories/contracts/verifiers";
import { BasePaymentVerifier__factory } from "../typechain/factories/contracts/verifiers";

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

  public async deployVenmoReclaimVerifier(
    ramp: Address,
    nullifierRegistry: Address,
    timestampBuffer: BigNumber = BigNumber.from(30),
    currencies: string[],
    providerHashes: string[],
    claimVerifierLibraryName: string,
    claimVerifierLibraryAddress: Address,
  ): Promise<VenmoReclaimVerifier> {
    return await new VenmoReclaimVerifier__factory(
      // @ts-ignore
      {
        [claimVerifierLibraryName]: claimVerifierLibraryAddress,
      },
      this._deployerSigner
    ).deploy(
      ramp,
      nullifierRegistry,
      timestampBuffer,
      currencies,
      providerHashes
    );
  }

  public async deployNullifierRegistry(): Promise<NullifierRegistry> {
    return await new NullifierRegistry__factory(this._deployerSigner).deploy();
  }

  public async deployQuoter(escrow: Address): Promise<Quoter> {
    return await new Quoter__factory(this._deployerSigner).deploy(escrow);
  }

  public async deployClaimVerifier(): Promise<ClaimVerifier> {
    return await new ClaimVerifier__factory(this._deployerSigner).deploy();
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

  public async deployClaimVerifierMock(libraryName: string, libraryAddress: Address): Promise<ClaimVerifierMock> {
    return await new ClaimVerifierMock__factory(
      // @ts-ignore
      {
        [libraryName]: libraryAddress,
      },
      this._deployerSigner
    ).deploy();
  }
}
