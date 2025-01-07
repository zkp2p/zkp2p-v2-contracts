import { BigNumber } from "ethers";

export type Address = string;

export type GrothProof = {
  a: [BigNumber, BigNumber],
  b: [[BigNumber, BigNumber], [BigNumber, BigNumber]],
  c: [BigNumber, BigNumber],
  signals: BigNumber[]
}

export interface ReclaimProof {
  claimInfo: ClaimInfo;
  signedClaim: SignedClaim;
  isAppclipProof: boolean;
}

export interface ClaimInfo {
  provider: string;
  parameters: string;
  context: string;
}

export interface CompleteClaimData {
  identifier: string;
  owner: Address;
  timestampS: BigNumber;
  epoch: BigNumber;
}

export interface SignedClaim {
  claim: CompleteClaimData;
  signatures: string[];
}

export enum PaymentService {
  VenmoReclaim = "venmo_reclaim",
}
