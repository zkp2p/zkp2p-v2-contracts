import { utils } from 'ethers';
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
	// "claim": {
	//   "provider": "http",
	//   "parameters": "{\"body\":\"\",\"method\":\"GET\",\"paramValues\":{\"SENDER_ID\":\"1168869611798528966\"},\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"amount\\\":\\\"- \\\\$(?<amount>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"date\\\":\\\"(?<date>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"paymentId\\\":\\\"(?<paymentId>[^\\\"]+)\\\"\"},{\"hash\":true,\"type\":\"regex\",\"value\":\"\\\"id\\\":\\\"(?<receiverId>[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.stories[0].amount\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[0].date\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[0].paymentId\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[0].title.receiver.id\",\"xPath\":\"\"}],\"url\":\"https://account.venmo.com/api/stories?feedType=me&externalId={{SENDER_ID}}\"}",
	//   "owner": "0xf9f25d1b846625674901ace47d6313d1ac795265",
	//   "timestampS": 1736195782,
	//   "context": "{\"contextAddress\":\"\",\"contextMessage\":\"4550365876404035370013319374327198777228946732305032418394862064756897839843\",\"extractedParameters\":{\"SENDER_ID\":\"1168869611798528966\",\"amount\":\"1.01\",\"date\":\"2025-01-06T18:21:21\",\"paymentId\":\"4239767587180066226\",\"receiverId\":\"0x92d30391a78fc6c9849a17fbcb598c3d33f589553c5339537ab3e0fa58d7c14d\"},\"providerHash\":\"0xbbb4d6813c1ccac7253673094ce4c1e122fe358682392851cfa332fe8359b8fd\"}",
	//   "identifier": "0x121a29df03357bcf1f8a94246a0b53d9d24d6a326ab70b524920368311799730",
	//   "epoch": 1
	// },
	// "signatures": {
	//   "attestorAddress": "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
	//   "claimSignature": { "0": 228, "1": 113, "2": 191, "3": 128, "4": 171, "5": 133, "6": 180, "7": 35, "8": 56, "9": 175, "10": 84, "11": 135, "12": 197, "13": 64, "14": 240, "15": 193, "16": 137, "17": 46, "18": 60, "19": 170, "20": 59, "21": 169, "22": 218, "23": 104, "24": 178, "25": 0, "26": 40, "27": 32, "28": 211, "29": 152, "30": 129, "31": 127, "32": 36, "33": 237, "34": 221, "35": 50, "36": 128, "37": 110, "38": 220, "39": 58, "40": 98, "41": 245, "42": 63, "43": 110, "44": 170, "45": 92, "46": 147, "47": 81, "48": 21, "49": 87, "50": 225, "51": 55, "52": 171, "53": 218, "54": 180, "55": 47, "56": 202, "57": 0, "58": 236, "59": 172, "60": 186, "61": 191, "62": 16, "63": 132, "64": 28 },
	//   "resultSignature": { "0": 138, "1": 251, "2": 54, "3": 204, "4": 229, "5": 219, "6": 63, "7": 186, "8": 161, "9": 44, "10": 52, "11": 156, "12": 187, "13": 17, "14": 103, "15": 241, "16": 118, "17": 132, "18": 225, "19": 250, "20": 148, "21": 76, "22": 70, "23": 229, "24": 6, "25": 84, "26": 186, "27": 207, "28": 144, "29": 234, "30": 32, "31": 136, "32": 122, "33": 217, "34": 206, "35": 68, "36": 163, "37": 211, "38": 240, "39": 126, "40": 98, "41": 144, "42": 176, "43": 106, "44": 254, "45": 86, "46": 188, "47": 166, "48": 12, "49": 224, "50": 108, "51": 152, "52": 166, "53": 92, "54": 92, "55": 127, "56": 107, "57": 3, "58": 45, "59": 153, "60": 84, "61": 194, "62": 199, "63": 220, "64": 28 }
	// }
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
		},
		isAppclipProof: false
	} as ReclaimProof;
};


export const parseAppclipProof = (proofObject: any) => {
	// "claim": {
	//   "identifier": "0x1625c2abaacc64e8f2be84f0b1600c10c82871f9680315ce07b1637035f76cdb",
	//   "claimData": {
	//     "provider": "http",
	//     "parameters": { "additionalClientOptions": {}, "body": "", "geoLocation": "", "headers": { "Referer": "https://account.venmo.com/account/mfa/code-prompt?k=GaGokSMZ6HPHRbHjmKW1jCLEKvP1lz49F3YiDSW5hDHwQpFsHA00gi2HNanwIaDB&next=%2F%3Ffeed%3Dmine", "Sec-Fetch-Mode": "same-origin", "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1" }, "method": "GET", "paramValues": { "URL_PARAMS_GRD": "1168869611798528966", "amount": "1.01", "date": "2025-01-06T18:21:21", "paymentId": "4239767587180066226", "receiverId": "645716473020416186" }, "responseMatches": [{ "invert": false, "type": "contains", "value": "\"amount\":\"- ${{amount}}\"" }, { "invert": false, "type": "contains", "value": "\"date\":\"{{date}}\"" }, { "invert": false, "type": "contains", "value": "\"id\":\"{{receiverId}}\"" }, { "invert": false, "type": "contains", "value": "\"paymentId\":\"{{paymentId}}\"" }], "responseRedactions": [{ "jsonPath": "$.stories[0].amount", "regex": "\"amount\":\"- \\$(.*)\"", "xPath": "" }, { "jsonPath": "$.stories[0].date", "regex": "\"date\":\"(.*)\"", "xPath": "" }, { "jsonPath": "$.stories[0].title.receiver.id", "regex": "\"id\":\"(.*)\"", "xPath": "" }, { "jsonPath": "$.stories[0].paymentId", "regex": "\"paymentId\":\"(.*)\"", "xPath": "" }], "url": "https://account.venmo.com/api/stories?feedType=me&externalId={{URL_PARAMS_GRD}}" },
	//     "owner": "0xa4f239ae872b61a640b232f2066f21862caef5c1",
	//     "timestampS": 1736190917,
	//     "context": { "contextAddress": "0x0", "contextMessage": "", "extractedParameters": { "URL_PARAMS_GRD": "1168869611798528966", "amount": "1.01", "date": "2025-01-06T18:21:21", "paymentId": "4239767587180066226", "receiverId": "645716473020416186" }, "providerHash": "0x14de8b5503a4a6973bbaa9aa301ec7843e9bcaa3af05e6610b54c6fcc56aa425" },
	//     "epoch": 1
	//   },
	//   "signatures": {
	//     "0": "0xd13dfb32a32ac2e91e9a54fc7d04faffa15f6facf3bed6033c775f8775dde0c771592c870b7406617d25f06cc7e620ac3de3a49769d8aba23532122bbc3508ef1c"
	//   },
	//   "witnesses": {
	//     "0": {
	//       "id": "0x244897572368eadf65bfbc5aec98d8e5443a9072",
	//       "url": "wss://witness.reclaimprotocol.org/ws",
	//       "publicData": ""
	//     }
	//   }
	// }
	return {
		claimInfo: {
			provider: proofObject.claim.claimData.provider,
			parameters: JSON.stringify(proofObject.claim.claimData.parameters),
			context: JSON.stringify(proofObject.claim.claimData.context)
		},
		signedClaim: {
			claim: {
				identifier: proofObject.claim.identifier,
				owner: proofObject.claim.claimData.owner,
				timestampS: BigNumber.from(proofObject.claim.claimData.timestampS),
				epoch: BigNumber.from(proofObject.claim.claimData.epoch)
			},
			signatures: Object.values(proofObject.claim.signatures).map((sig: unknown) => sig as string)
		},
		isAppclipProof: true
	} as ReclaimProof;
}

export const encodeProof = (proof: ReclaimProof) => {
	const PROOF_ENCODING_STRING = "(tuple(string provider, string parameters, string context) claimInfo, tuple(tuple(bytes32 identifier, address owner, uint32 timestampS, uint32 epoch) claim, bytes[] signatures) signedClaim, bool isAppclipProof)";
	return ethers.utils.defaultAbiCoder.encode(
		[PROOF_ENCODING_STRING],
		[proof]
	);
};