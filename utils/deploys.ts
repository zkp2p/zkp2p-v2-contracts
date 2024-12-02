import { BigNumber, Signer, ethers } from "ethers";

import { Address } from "@utils/types";

const circom = require("circomlibjs");

import {
  USDCMock,
  RampV2,
  PaymentVerifierMock,
  VenmoReclaimVerifier,
  NullifierRegistry,
  StringConversionUtilsMock,
  ClaimVerifierMock
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
import { ClaimVerifier } from "@typechain/contracts/lib/ClaimVerifier";
import { RampV2__factory } from "../typechain/factories/contracts/index";
import { VenmoReclaimVerifier__factory } from "../typechain/factories/contracts/verifiers";

export default class DeployHelper {
  private _deployerSigner: Signer;

  constructor(deployerSigner: Signer) {
    this._deployerSigner = deployerSigner;
  }

  public async deployUSDCMock(mintAmount: BigNumber, name: string, symbol: string): Promise<USDCMock> {
    return await new USDCMock__factory(this._deployerSigner).deploy(mintAmount.toString(), name, symbol);
  }

  public async deployRampV2(
    owner: Address,
    minDepositAmount: BigNumber,
    intentExpirationPeriod: BigNumber,
    sustainabilityFee: BigNumber,
    sustainabilityFeeRecipient: Address
  ): Promise<RampV2> {
    return await new RampV2__factory(this._deployerSigner).deploy(
      owner,
      minDepositAmount,
      intentExpirationPeriod,
      sustainabilityFee,
      sustainabilityFeeRecipient
    );
  }

  public async deployPaymentVerifierMock(): Promise<PaymentVerifierMock> {
    return await new PaymentVerifierMock__factory(this._deployerSigner).deploy();
  }

  public async deployVenmoReclaimVerifier(
    ramp: Address,
    nullifierRegistry: Address,
    providerHashes: string[],
    timestampBuffer: BigNumber = BigNumber.from(30),
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
      providerHashes,
      timestampBuffer
    );
  }


  public async deployNullifierRegistry(): Promise<NullifierRegistry> {
    return await new NullifierRegistry__factory(this._deployerSigner).deploy();
  }

  public async deployStringConversionUtilsMock(): Promise<StringConversionUtilsMock> {
    return await new StringConversionUtilsMock__factory(this._deployerSigner).deploy();
  }

  public async deployClaimVerifier(): Promise<ClaimVerifier> {
    return await new ClaimVerifier__factory(this._deployerSigner).deploy();
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
