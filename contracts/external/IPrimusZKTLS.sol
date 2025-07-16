// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

/**
 * @dev Structure representing an attestation, which is a signed statement of fact.
 */
struct Attestation {
    address recipient; // The recipient of the attestation.
    AttNetworkRequest request; // The network request send to jsk and related to the attestation.
    AttNetworkResponseResolve[] reponseResolve; // The response details responsed from jdk.
    string data; // Real data in the pending body provided in JSON string format.
    string attConditions; // Attestation parameters in JSON string format.
    uint64 timestamp; // The timestamp of when the attestation was created.
    string additionParams; // Extra data for more inormation.
    Attestor[] attestors; // List of attestors who signed the attestation.
    bytes[] signatures; // signature from the attestor.
}

/**
 * @dev Structure for representing a network request send to jsk and related to the attestation.
 */
struct AttNetworkRequest {
    string url; // The URL to which the request is sent.
    string header; // The request headers in JSON string format.
    string method; // HTTP method used in the request (e.g., GET, POST).
    string body; // The body of the request, typically in JSON format.
}

/**
 * @dev Structure for resolving responses from a network request.
 */
struct AttNetworkResponseResolve {
    string keyName; // The key in the response data to be resolved.
    string parseType; // The format of the response data to parse (e.g., JSON, HTML).
    string parsePath; // The path used to parse the response (e.g., JSONPath, XPath).
}

/**
 * @dev Structure representing an attestor, who is responsible for signing the attestation.
 */
struct Attestor {
    address attestorAddr; // The address of the attestor.
    string url; // URL associated with the attestor, such as a profile or additional information.
}


/**
 * @dev Interface of PrimusZKTLS, which defines functions for handling attestations and related operations.
 */
interface IPrimusZKTLS {
  
    /**
     *  @dev Verifies the validity of a given attestation. 
     * This includes checking the signature of attestor, 
     * the integrity of the data, and the attestation's consistency.
     *
     * @param attestation The attestation data to be verified. 
     * It contains details about the recipient, request, response, and attestors.
     *
     * Requirements:
     * - The attestation must have valid signatures from all listed attestors.
     * - The data must match the provided request and response structure.
     * - The attestation must not be expired (based on its timestamp).
     *
     * Emits no events.
     */
    function verifyAttestation(Attestation calldata attestation) external view;

}
