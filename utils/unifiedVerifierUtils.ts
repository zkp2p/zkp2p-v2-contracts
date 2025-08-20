import { BytesLike, BigNumber, ethers } from "ethers"
import { Account } from "@utils/test/types"
import { Address } from "@utils/types"

export type PaymentDetails = {
  paymentMethod: BytesLike;
  providerHash: BytesLike;
  intentHash: BytesLike;
  recipientId: string;
  amount: BigNumber;
  timestamp: BigNumber;
  paymentId: string;
  currency: BytesLike;
  signatures: BytesLike[];
  dataHash: BytesLike;
}


// Helper function to sign payment details using EIP-712
export async function signPaymentDetails(
  signer: Account,
  paymentDetails: PaymentDetails,
  unifiedVerifierContract: Address,
  chainId: number = 31337
): Promise<string> {

  const domain = {
    name: 'UnifiedPaymentVerifier',
    version: '1',
    chainId: chainId,
    verifyingContract: unifiedVerifierContract as Address
  };

  const types = {
    PaymentDetails: [
      { name: 'paymentMethod', type: 'bytes32' },
      { name: 'providerHash', type: 'bytes32' },
      { name: 'intentHash', type: 'bytes32' },
      { name: 'recipientId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'paymentId', type: 'bytes32' },
      { name: 'currency', type: 'bytes32' },
      { name: 'dataHash', type: 'bytes32' }
    ]
  };

  const value = {
    paymentMethod: paymentDetails.paymentMethod,
    providerHash: paymentDetails.providerHash,
    intentHash: paymentDetails.intentHash,
    recipientId: paymentDetails.recipientId,
    amount: paymentDetails.amount,
    timestamp: paymentDetails.timestamp,
    paymentId: paymentDetails.paymentId,
    currency: paymentDetails.currency,
    dataHash: paymentDetails.dataHash
  };

  // return await signer.wallet.signMessage(ethers.utils.arrayify(digest));
  return await signer.wallet._signTypedData(domain, types, value);
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
      paymentDetails.dataHash
    ]]
  );
}

export async function createAttestation(
  signer: Account,
  paymentDetails: PaymentDetails,
  unifiedVerifierContract: Address
): Promise<BytesLike> {

  const signature = await signPaymentDetails(signer, paymentDetails, unifiedVerifierContract);

  const paymentDetailsWithSignature = {
    ...paymentDetails,
    signatures: [signature]
  } as PaymentDetails;


  return encodePaymentDetails(paymentDetailsWithSignature);
}