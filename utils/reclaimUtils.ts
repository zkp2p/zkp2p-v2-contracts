import { BytesLike, utils } from 'ethers';
import canonicalize from 'canonicalize';

import { ClaimInfo, CompleteClaimData } from './types';
import { ethers } from 'ethers';
import { BigNumber } from 'ethers';
import { ReclaimProof } from './types';

/**
 * Creates the standard string to sign for a claim.
 * This data is what the witness will sign when it successfully
 * verifies a claim.
 */
export function createSignDataForClaim(data: CompleteClaimData) {
	const identifier = 'identifier' in data
		? data.identifier
		: getIdentifierFromClaimInfo(data)
	const lines = [
		identifier,
		// we lowercase the owner to ensure that the
		// ETH addresses always serialize the same way
		data.owner.toLowerCase(),
		data.timestampS.toString(),
		data.epoch.toString(),
	]

	return lines.join('\n')
}

/**
 * Generates a unique identifier for given claim info
 * @param info
 * @returns
 */
export function getIdentifierFromClaimInfo(info: ClaimInfo): string {
	//re-canonicalize context if it's not empty
	if (info.context?.length > 0) {
		try {
			const ctx = JSON.parse(info.context)
			info.context = canonicalize(ctx)!
		} catch (e) {
			throw new Error('unable to parse non-empty context. Must be JSON')
		}
	}

	const str = `${info.provider}\n${info.parameters}\n${info.context || ''}`

	return utils.keccak256(
		new TextEncoder().encode(str)
	).toLowerCase()
}


/**
 * Converts a signature uint8array returned by reclaim witness server to a hex string.
 * @param signature
 * @returns
 */
export function convertSignatureToHex(signature: { [key: string]: number }): string {
	const byteArray = Object.values(signature);
	return '0x' + Buffer.from(byteArray).toString('hex');
}


export const parseExtensionProof = (proofObject: any) => {
	return {
		claimInfo: {
			provider: proofObject.claim.provider,
			parameters: proofObject.claim.parameters,
			context: proofObject.claim.context
		},
		signedClaim: {
			claim: {
				identifier: proofObject.claim.identifier,
				owner: proofObject.claim.owner,
				timestampS: BigNumber.from(proofObject.claim.timestampS),
				epoch: BigNumber.from(proofObject.claim.epoch)
			},
			signatures: [convertSignatureToHex(proofObject.signatures.claimSignature)]
		}
	} as ReclaimProof;
};



const PROOF_ENCODING_STRING = "(tuple(string provider, string parameters, string context) claimInfo, tuple(tuple(bytes32 identifier, address owner, uint32 timestampS, uint32 epoch) claim, bytes[] signatures) signedClaim)";

export const encodeProof = (proof: ReclaimProof) => {
	return ethers.utils.defaultAbiCoder.encode(
		[PROOF_ENCODING_STRING],
		[proof]
	);
};

export const encodeTwoProofs = (proof1: ReclaimProof, proof2: ReclaimProof) => {
	return ethers.utils.defaultAbiCoder.encode(
		[PROOF_ENCODING_STRING, PROOF_ENCODING_STRING],
		[proof1, proof2]
	);
};

export const encodeProofWithPaymentMethod = (proof: BytesLike, paymentMethod: number) => {
	return ethers.utils.solidityPack(['uint8', 'bytes'], [paymentMethod, proof]);
};

export const encodePrimusProof = (proof: any) => {
	return ethers.utils.defaultAbiCoder.encode(
		['tuple(address recipient, tuple(string url, string header, string method, string body) request, tuple(string keyName, string parseType, string parsePath)[] reponseResolve, string data, string attConditions, uint64 timestamp, string additionParams, tuple(address attestorAddr, string url)[] attestors, bytes[] signatures)'],
		[proof]
	);
};