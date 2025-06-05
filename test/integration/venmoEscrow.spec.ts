import "module-alias/register";

import { ethers, network } from "hardhat";

import {
  Address,
  ReclaimProof,
} from "@utils/types";
import { Account } from "@utils/test/types";
import {
  Escrow,
  IEscrow,
  USDCMock,
  PaymentVerifierMock,
  VenmoReclaimVerifier,
  NullifierRegistry
} from "@utils/contracts";
import DeployHelper from "@utils/deploys";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";
import { Blockchain, ether, usdc } from "@utils/common";
import { BigNumber } from "ethers";
import { ZERO, ZERO_BYTES32, ADDRESS_ZERO, ONE } from "@utils/constants";
import { calculateIntentHash, calculateRevolutIdHash, calculateRevolutIdHashBN } from "@utils/protocolUtils";
import { ONE_DAY_IN_SECONDS } from "@utils/constants";
import { Currency } from "@utils/protocolUtils";
import { generateGatingServiceSignature } from "@utils/test/helpers";

const expect = getWaffleExpect();

const blockchain = new Blockchain(ethers.provider);

const venmoPaymentProof = {
  provider: "http",
  parameters: "{\"body\":\"\",\"method\":\"GET\",\"responseMatches\":[{\"type\":\"regex\",\"value\":\"\\\"amount\\\":\\\"- \\\\$(?<amount>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"date\\\":\\\"(?<date>[^\\\"]+)\\\"\"},{\"hash\":true,\"type\":\"regex\",\"value\":\"\\\"receiver\\\":\\\\{\\\"id\\\":\\\"(?<receiverId>[^\\\"]+)\\\"\"},{\"type\":\"regex\",\"value\":\"\\\"paymentId\\\":\\\"(?<paymentId>[^\\\"]+)\\\"\"}],\"responseRedactions\":[{\"jsonPath\":\"$.stories[9].amount\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[9].date\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[9].title.receiver\",\"xPath\":\"\"},{\"jsonPath\":\"$.stories[9].paymentId\",\"xPath\":\"\"}],\"url\":\"https://account.venmo.com/api/stories?feedType=me&externalId=1168869611798528966\"}",
  owner: "0xf9f25d1b846625674901ace47d6313d1ac795265",
  timestampS: 1733360800,
  context: "{\"extractedParameters\":{\"amount\":\"5.00\",\"date\":\"2024-10-03T00:17:47\",\"paymentId\":\"4170368513012150718\",\"receiverId\":\"0x92d30391a78fc6c9849a17fbcb598c3d33f589553c5339537ab3e0fa58d7c14d\"},\"intentHash\":\"0x13fef05b6e8b28553c61e6fc4bdb247ce2108c51851d6b8695648f693456705a\",\"providerHash\":\"0x92da474c63ba5e4ce0b927c557dc78dfd4b6284c39c587725c41c55cf709cae5\"}",
  identifier: "0x08c8534df846ad255229df3908371d41d8372f81e96757564f20968dc9f4d0ad",
  epoch: 1,
  signature: { "0": 220, "1": 214, "2": 76, "3": 58, "4": 99, "5": 70, "6": 84, "7": 124, "8": 228, "9": 60, "10": 131, "11": 212, "12": 57, "13": 215, "14": 71, "15": 13, "16": 115, "17": 208, "18": 44, "19": 195, "20": 118, "21": 2, "22": 210, "23": 0, "24": 232, "25": 134, "26": 61, "27": 82, "28": 144, "29": 67, "30": 103, "31": 234, "32": 39, "33": 146, "34": 198, "35": 231, "36": 174, "37": 22, "38": 32, "39": 137, "40": 157, "41": 189, "42": 59, "43": 231, "44": 160, "45": 4, "46": 29, "47": 178, "48": 97, "49": 75, "50": 240, "51": 10, "52": 0, "53": 213, "54": 142, "55": 173, "56": 90, "57": 131, "58": 109, "59": 83, "60": 1, "61": 140, "62": 144, "63": 206, "64": 28 }, "resultSignature": { "0": 76, "1": 226, "2": 66, "3": 72, "4": 85, "5": 168, "6": 196, "7": 117, "8": 113, "9": 67, "10": 150, "11": 173, "12": 56, "13": 65, "14": 66, "15": 4, "16": 39, "17": 58, "18": 140, "19": 221, "20": 208, "21": 26, "22": 241, "23": 4, "24": 115, "25": 57, "26": 168, "27": 87, "28": 56, "29": 171, "30": 119, "31": 71, "32": 27, "33": 245, "34": 138, "35": 33, "36": 234, "37": 238, "38": 241, "39": 210, "40": 145, "41": 151, "42": 111, "43": 38, "44": 136, "45": 222, "46": 90, "47": 51, "48": 89, "49": 151, "50": 101, "51": 164, "52": 111, "53": 8, "54": 223, "55": 77, "56": 147, "57": 93, "58": 29, "59": 186, "60": 223, "61": 253, "62": 101, "63": 183, "64": 27 }
}

describe.skip("VenmoEscrow", () => {
  let owner: Account;
  let offRamper: Account;
  let offRamperNewAcct: Account;
  let onRamper: Account;
  let onRamperOtherAddress: Account;
  let onRamperTwo: Account;
  let receiver: Account;
  let maliciousOnRamper: Account;
  let feeRecipient: Account;
  let gatingService: Account;
  let chainId: BigNumber = ONE;

  let ramp: Escrow;
  let usdcToken: USDCMock;

  let providerHash: string;
  let witnessAddress: Address;

  let nullifierRegistry: NullifierRegistry;
  let verifier: VenmoReclaimVerifier;

  let deployer: DeployHelper;

  let subjectProof: string;
  let subjectIntentHash: string;
  let subjectCaller: Account;

  let intentHash: string;
  let payeeDetails: string;
  let proof: ReclaimProof;

  beforeEach(async () => {
    [
      owner,
      offRamper,
      onRamper,
      onRamperOtherAddress,
      onRamperTwo,
      receiver,
      maliciousOnRamper,
      offRamperNewAcct,
      feeRecipient,
      gatingService,
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);

    usdcToken = await deployer.deployUSDCMock(usdc(1000000000), "USDC", "USDC");

    await usdcToken.transfer(offRamper.address, usdc(10000));

    ramp = await deployer.deployEscrow(
      owner.address,
      ONE_DAY_IN_SECONDS,                // 1 day intent expiration period
      ZERO,                              // Sustainability fee
      feeRecipient.address,
      chainId
    );

    witnessAddress = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
    providerHash = "0x92da474c63ba5e4ce0b927c557dc78dfd4b6284c39c587725c41c55cf709cae5";

    nullifierRegistry = await deployer.deployNullifierRegistry();
    verifier = await deployer.deployVenmoReclaimVerifier(
      ramp.address,
      nullifierRegistry.address,
      BigNumber.from(30),
      [Currency.USD],
      [providerHash]
    );

    await ramp.addWhitelistedPaymentVerifier(verifier.address, ZERO);
    await nullifierRegistry.connect(owner.wallet).addWritePermission(verifier.address);

    // Create a deposit and signal an intent first
    await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));
    payeeDetails = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("645716473020416186"));
    const depositData = ethers.utils.defaultAbiCoder.encode(
      ["address"],
      [witnessAddress]
    );

    const depositConversionRate = ether(1.08);
    const createDepositTx = await ramp.connect(offRamper.wallet).createDeposit(
      usdcToken.address,
      usdc(100),
      { min: usdc(1), max: usdc(200) },
      [verifier.address],
      [{
        intentGatingService: gatingService.address,
        payeeDetails: payeeDetails,
        data: depositData
      }],
      [
        [{ code: Currency.USD, minConversionRate: depositConversionRate }]
      ],
      ethers.constants.AddressZero
    );
    const createDepositReceipt = await createDepositTx.wait();
    console.log("Create deposit gas used:", createDepositReceipt.gasUsed.toString());

    const gatingServiceSignature = await generateGatingServiceSignature(
      ZERO,
      usdc(5),
      onRamper.address,
      verifier.address,
      Currency.USD,
      depositConversionRate,
      chainId.toString()
    );
    const signalIntentTx = await ramp.connect(onRamper.wallet).signalIntent(
      ZERO, // depositId
      usdc(5),
      onRamper.address,
      verifier.address,
      Currency.USD,
      depositConversionRate,
      gatingServiceSignature,
      ADDRESS_ZERO, // postIntentHook
      "0x"          // data for postIntentHook
    );
    const signalIntentReceipt = await signalIntentTx.wait();
    console.log("Signal intent gas used:", signalIntentReceipt.gasUsed.toString());

    // NOTE: the proof intent hash uses this exact timestamp. Don't modify the timestamp!
    const currentTimestamp = await blockchain.getCurrentTimestamp();
    intentHash = calculateIntentHash(onRamper.address, verifier.address, ZERO, currentTimestamp);

    // Prepare the proof and processor for the onRamp function
    proof = {
      claimInfo: {
        provider: venmoPaymentProof.provider,
        parameters: venmoPaymentProof.parameters,
        context: venmoPaymentProof.context
      },
      signedClaim: {
        claim: {
          identifier: venmoPaymentProof.identifier,
          owner: venmoPaymentProof.owner,
          timestampS: BigNumber.from(venmoPaymentProof.timestampS),
          epoch: BigNumber.from(venmoPaymentProof.epoch)
        },
        signatures: [convertSignatureToHex(venmoPaymentProof.signature)]
      },
      isAppclipProof: false
    };
    subjectProof = ethers.utils.defaultAbiCoder.encode(
      [
        "(tuple(string provider, string parameters, string context) claimInfo, tuple(tuple(bytes32 identifier, address owner, uint32 timestampS, uint32 epoch) claim, bytes[] signatures) signedClaim)"
      ],
      [proof]
    );
    subjectIntentHash = intentHash;
    subjectCaller = onRamper;
  });

  function convertSignatureToHex(signature: { [key: string]: number }): string {
    const byteArray = Object.values(signature);
    return '0x' + Buffer.from(byteArray).toString('hex');
  }

  describe("Fulfill intent integration test", async () => {
    async function subject(): Promise<any> {
      return ramp.connect(subjectCaller.wallet).fulfillIntent(subjectProof, subjectIntentHash, "0x");
    }

    it("should transfer the correct amount to the on-ramper", async () => {
      const initialBalance = await usdcToken.balanceOf(onRamper.address);
      const preDeposit = await ramp.getDeposit(ZERO);

      const tx = await subject();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed;
      console.log(`Gas used for fulfillIntent: ${gasUsed.toString()}`);

      const finalBalance = await usdcToken.balanceOf(onRamper.address);
      const intent = await ramp.getIntent(subjectIntentHash);

      expect(intent.owner).to.eq(ADDRESS_ZERO); // Intent should be deleted
      expect(finalBalance.sub(initialBalance)).to.eq(usdc(5));
      const postDeposit = await ramp.getDeposit(ZERO);
      expect(postDeposit.outstandingIntentAmount).to.eq(preDeposit.outstandingIntentAmount.sub(usdc(5)));
    });
  });
});