import { BytesLike, BigNumber, ethers } from "ethers";

import { Account } from "@utils/test/types";
import { Address } from "@utils/types";

/* -------------------------------------------------------------------------- */
/* Legacy helpers (PaymentAttestation V1)                                     */
/* -------------------------------------------------------------------------- */

export type PaymentDetails = {
  paymentMethod: BytesLike;
  providerHash: BytesLike;
  intentHash: BytesLike;
  recipientId: BytesLike;
  amount: BigNumber;
  timestamp: BigNumber;
  paymentId: BytesLike;
  currency: BytesLike;
  signatures: BytesLike[];
  dataHash: BytesLike;
};

const ZERO_BYTES = "0x";

export async function signPaymentDetails(
  signer: Account,
  paymentDetails: PaymentDetails,
  unifiedVerifierContract: Address,
  chainId: number = 31337,
): Promise<string> {
  const domain = {
    name: "UnifiedPaymentVerifier",
    version: "1",
    chainId,
    verifyingContract: unifiedVerifierContract as Address,
  };

  const types = {
    PaymentAttestation: [
      { name: "paymentMethod", type: "bytes32" },
      { name: "providerHash", type: "bytes32" },
      { name: "intentHash", type: "bytes32" },
      { name: "recipientId", type: "bytes32" },
      { name: "amount", type: "uint256" },
      { name: "timestamp", type: "uint256" },
      { name: "paymentId", type: "bytes32" },
      { name: "currency", type: "bytes32" },
      { name: "dataHash", type: "bytes32" },
    ],
  };

  return signer.wallet._signTypedData(domain, types, {
    paymentMethod: paymentDetails.paymentMethod,
    providerHash: paymentDetails.providerHash,
    intentHash: paymentDetails.intentHash,
    recipientId: paymentDetails.recipientId,
    amount: paymentDetails.amount,
    timestamp: paymentDetails.timestamp,
    paymentId: paymentDetails.paymentId,
    currency: paymentDetails.currency,
    dataHash: paymentDetails.dataHash,
  });
}

export function encodePaymentDetails(paymentDetails: PaymentDetails): BytesLike {
  return ethers.utils.defaultAbiCoder.encode(
    ['tuple(bytes32,bytes32,bytes32,bytes32,uint256,uint256,bytes32,bytes32,bytes[],bytes32)'],
    [[
      paymentDetails.paymentMethod,
      paymentDetails.providerHash,
      paymentDetails.intentHash,
      paymentDetails.recipientId,
      paymentDetails.amount,
      paymentDetails.timestamp,
      paymentDetails.paymentId,
      paymentDetails.currency,
      paymentDetails.signatures,
      paymentDetails.dataHash,
    ]],
  );
}

export async function createAttestation(
  signer: Account,
  paymentDetails: PaymentDetails,
  unifiedVerifierContract: Address,
): Promise<BytesLike> {
  const signature = await signPaymentDetails(
    signer,
    { ...paymentDetails, signatures: [] },
    unifiedVerifierContract,
  );

  const paymentDetailsWithSignature: PaymentDetails = {
    ...paymentDetails,
    signatures: [signature],
  };

  return encodePaymentDetails(paymentDetailsWithSignature);
}

/* -------------------------------------------------------------------------- */
/* New Unified Payment Verifier helpers                                       */
/* -------------------------------------------------------------------------- */

export interface UnifiedPaymentDetails {
  method: BytesLike;
  payeeId: BytesLike;
  amount: BigNumber;
  currency: BytesLike;
  timestamp: BigNumber;
  paymentId: BytesLike;
}

export interface UnifiedPaymentAttestationParams {
  intentHash: BytesLike;
  releaseAmount: BigNumber;
  dataHash: BytesLike;
  chainId?: number;
}

export interface UnifiedPaymentAttestation extends UnifiedPaymentAttestationParams {
  signatures: string[];
  data: BytesLike;
  metadata: BytesLike;
}

export interface BuiltUnifiedPaymentProof {
  paymentProof: BytesLike;
  attestation: UnifiedPaymentAttestation;
  paymentDetails: UnifiedPaymentDetails;
  encodedPaymentDetails: BytesLike;
}

export interface BuildPaymentProofOverrides {
  intentHash?: BytesLike;
  releaseAmount?: BigNumber;
  method?: BytesLike;
  payeeId?: BytesLike;
  amount?: BigNumber;
  currency?: BytesLike;
  timestamp?: BigNumber;
  paymentId?: BytesLike;
  metadata?: BytesLike;
  signer?: Account;
  attestationDataOverride?: BytesLike;
}

export interface BuildPaymentProofParams extends BuildPaymentProofOverrides {
  verifier: Address;
  witness: Account;
  chainId?: number;
}

export function encodeUnifiedPaymentDetails(details: UnifiedPaymentDetails): BytesLike {
  return ethers.utils.defaultAbiCoder.encode(
    ["tuple(bytes32,bytes32,uint256,bytes32,uint256,bytes32)"],
    [[
      details.method,
      details.payeeId,
      details.amount,
      details.currency,
      details.timestamp,
      details.paymentId,
    ]],
  );
}

export async function signUnifiedPaymentAttestation(
  witness: Account,
  verifier: Address,
  params: UnifiedPaymentAttestationParams,
): Promise<string> {
  const domain = {
    name: "UnifiedPaymentVerifier",
    version: "1",
    chainId: params.chainId ?? 31337,
    verifyingContract: verifier,
  };

  const types = {
    PaymentAttestation: [
      { name: "intentHash", type: "bytes32" },
      { name: "releaseAmount", type: "uint256" },
      { name: "dataHash", type: "bytes32" },
    ],
  };

  return witness.wallet._signTypedData(domain, types, {
    intentHash: params.intentHash,
    releaseAmount: params.releaseAmount,
    dataHash: params.dataHash,
  });
}

export async function buildUnifiedPaymentProof({
  verifier,
  witness,
  chainId = 31337,
  intentHash,
  releaseAmount,
  method,
  payeeId,
  amount,
  currency,
  timestamp,
  paymentId,
  metadata,
  signer,
  attestationDataOverride,
}: BuildPaymentProofParams): Promise<BuiltUnifiedPaymentProof> {
  const paymentDetails: UnifiedPaymentDetails = {
    method: method ?? ethers.constants.HashZero,
    payeeId: payeeId ?? ethers.constants.HashZero,
    amount: amount ?? BigNumber.from(0),
    currency: currency ?? ethers.constants.HashZero,
    timestamp: timestamp ?? BigNumber.from(0),
    paymentId: paymentId ?? ethers.constants.HashZero,
  };

  const encodedPaymentDetails = encodeUnifiedPaymentDetails(paymentDetails);
  const dataHash = ethers.utils.keccak256(encodedPaymentDetails);

  const attestationIntentHash = intentHash ?? ethers.constants.HashZero;
  const attestationReleaseAmount = releaseAmount ?? paymentDetails.amount;
  const attestationMetadata = metadata ?? ZERO_BYTES;
  const signerAccount = signer ?? witness;
  const attestationData = attestationDataOverride ?? encodedPaymentDetails;

  const signature = await signUnifiedPaymentAttestation(signerAccount, verifier, {
    intentHash: attestationIntentHash,
    releaseAmount: attestationReleaseAmount,
    dataHash,
    chainId,
  });

  const signatures = [signature];

  const paymentProof = ethers.utils.defaultAbiCoder.encode(
    ["tuple(bytes32,uint256,bytes32,bytes[],bytes,bytes)"],
    [[attestationIntentHash, attestationReleaseAmount, dataHash, signatures, attestationData, attestationMetadata]],
  );

  return {
    paymentProof,
    attestation: {
      intentHash: attestationIntentHash,
      releaseAmount: attestationReleaseAmount,
      dataHash,
      signatures,
      data: attestationData,
      metadata: attestationMetadata,
    },
    paymentDetails,
    encodedPaymentDetails,
  };
}
