import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";

import {
  Address,
} from "@utils/types";
import { Account } from "@utils/test/types";
import {
  Quoter,
  Escrow,
  IEscrow,
  USDCMock,
  PaymentVerifierMock,
} from "@utils/contracts";
import DeployHelper from "@utils/deploys";

import {
  getWaffleExpect,
  getAccounts
} from "@utils/test/index";
import { ether, usdc } from "@utils/common";
import { ZERO, ADDRESS_ZERO, ONE, ZERO_BYTES32 } from "@utils/constants";
import { ONE_DAY_IN_SECONDS } from "@utils/constants";
import { Currency } from "@utils/protocolUtils";


describe("Quoter", function () {
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
  let gatingServiceOther: Account;
  let witness: Account;
  let chainId: BigNumber = ONE;

  let ramp: Escrow;
  let usdcToken: USDCMock;
  let dummyToken: USDCMock;

  let verifier: PaymentVerifierMock;
  let otherVerifier: PaymentVerifierMock;
  let quoter: Quoter;
  let deployer: DeployHelper;

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
      gatingServiceOther,
      witness
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

    const nullifierRegistry = await deployer.deployNullifierRegistry();

    verifier = await deployer.deployPaymentVerifierMock(
      ramp.address,
      nullifierRegistry.address,
      ZERO,
      [Currency.USD, Currency.EUR, Currency.GBP]
    );
    otherVerifier = await deployer.deployPaymentVerifierMock(
      ramp.address,
      nullifierRegistry.address,
      ZERO,
      [Currency.USD, Currency.EUR, Currency.GBP]
    );

    await ramp.addWhitelistedPaymentVerifier(verifier.address, ZERO);
    await ramp.addWhitelistedPaymentVerifier(otherVerifier.address, ZERO);
    quoter = await deployer.deployQuoter(ramp.address);
  });

  const generateGatingServiceSignature = async (
    depositId: BigNumber,
    amount: BigNumber,
    to: Address,
    verifier: Address,
    fiatCurrency: string,
    chainId: string
  ) => {
    const messageHash = ethers.utils.solidityKeccak256(
      ["uint256", "uint256", "address", "address", "bytes32", "uint256"],
      [depositId, amount, to, verifier, fiatCurrency, chainId]
    );
    return await gatingService.wallet.signMessage(ethers.utils.arrayify(messageHash));
  }

  describe("constructor", function () {
    it("should set the escrow address correctly", async () => {
      expect(await quoter.escrow()).to.equal(ramp.address);
    });
  });

  describe("quoteMaxTokenOutputForExactFiatInput", function () {
    let subjectDepositIds: BigNumber[];
    let subjectToken: Address;
    let subjectVerifier: Address;
    let subjectCurrency: string;
    let subjectAmount: BigNumber;
    let subjectGatingService: Address;

    beforeEach(async () => {
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));

      // Deposit 1: Worst rates for all verifiers
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(150),
        { min: usdc(10), max: usdc(200) },
        [verifier.address, otherVerifier.address],
        [
          {
            intentGatingService: gatingService.address,
            payeeDetailsHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payee1")),
            data: "0x",
          },
          {
            intentGatingService: gatingService.address,
            payeeDetailsHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payee1")),
            data: "0x",
          },
        ],
        [
          [
            { code: Currency.USD, conversionRate: ether(1.5) },
            { code: Currency.EUR, conversionRate: ether(1.6) },
            { code: Currency.GBP, conversionRate: ether(1.7) },
          ],
          [
            { code: Currency.USD, conversionRate: ether(1.6) },
            { code: Currency.EUR, conversionRate: ether(1.7) },
            { code: Currency.GBP, conversionRate: ether(1.8) },
          ],
        ]
      );

      // Deposit 2: Best rate for USD
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(200),
        { min: usdc(20), max: usdc(100) },
        [verifier.address],
        [
          {
            intentGatingService: gatingService.address,
            payeeDetailsHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payee2")),
            data: "0x",
          },
        ],
        [
          [{ code: Currency.USD, conversionRate: ether(0.98) }],
        ]
      );

      // Deposit 3: Best rate for alternative verifier
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(200),
        { min: usdc(20), max: usdc(100) },
        [otherVerifier.address],
        [
          {
            intentGatingService: gatingService.address,
            payeeDetailsHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payee3")),
            data: "0x",
          },
        ],
        [
          [{ code: Currency.USD, conversionRate: ether(0.99) }],
        ]
      );

      // Deposit 4: Different token
      const DummyTokenFactory = await ethers.getContractFactory("USDCMock");
      dummyToken = await DummyTokenFactory.deploy(
        ether(1000000),
        "DAI",
        "DAI"
      );

      await dummyToken.transfer(offRamper.address, ether(10000));
      await dummyToken.connect(offRamper.wallet).approve(ramp.address, ether(10000));

      await ramp.connect(offRamper.wallet).createDeposit(
        dummyToken.address,
        ether(300),
        { min: ether(30), max: ether(400) },
        [verifier.address],
        [
          {
            intentGatingService: gatingService.address,
            payeeDetailsHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payee4")),
            data: "0x",
          },
        ],
        [
          [{ code: Currency.USD, conversionRate: ether(1.1) }],
        ]
      );

      // Deposit 5 - Filled order
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(50),
        { min: usdc(30), max: usdc(50) },
        [verifier.address],
        [
          {
            intentGatingService: gatingService.address,
            payeeDetailsHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payee5")),
            data: "0x",
          },
        ],
        [
          [{ code: Currency.USD, conversionRate: ether(1.2) }],
        ]
      );

      await ramp.connect(onRamper.wallet).signalIntent(
        BigNumber.from(4),
        usdc(49),
        onRamper.address,
        verifier.address,
        Currency.USD,
        await generateGatingServiceSignature(
          BigNumber.from(4),
          usdc(49),
          onRamper.address,
          verifier.address,
          Currency.USD,
          chainId.toString()
        )
      );

      // Deposit 6: Different currency
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(200),
        { min: usdc(20), max: usdc(100) },
        [verifier.address],
        [
          {
            intentGatingService: gatingService.address,
            payeeDetailsHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payee6")),
            data: "0x",
          },
        ],
        [
          [{ code: Currency.EUR, conversionRate: ether(1.05) }],
        ]
      );

      // Deposit 7: Different gating service
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(200),
        { min: usdc(20), max: usdc(100) },
        [verifier.address],
        [
          {
            intentGatingService: gatingServiceOther.address,
            payeeDetailsHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payee7")),
            data: "0x",
          },
        ],
        [
          [{ code: Currency.USD, conversionRate: ether(1.04) }],
        ]
      );

      subjectDepositIds = [
        ZERO,
        ONE,
        BigNumber.from(2),
        BigNumber.from(3),
        BigNumber.from(4),
        BigNumber.from(5),
        BigNumber.from(6),
        BigNumber.from(7)
      ];
      subjectToken = usdcToken.address;
      subjectVerifier = ADDRESS_ZERO;
      subjectCurrency = Currency.USD;
      subjectAmount = usdc(50);
      subjectGatingService = gatingService.address;
    });

    async function subject(): Promise<[IEscrow.DepositViewStruct, BigNumber]> {
      return quoter.quoteMaxTokenOutputForExactFiatInput(
        subjectDepositIds,
        subjectVerifier,
        subjectGatingService,
        subjectToken,
        subjectCurrency,
        subjectAmount
      );
    }

    it("should return the lowest USD rate among all deposits", async () => {
      const [bestDeposit, maxTokenAmount] = await subject();

      expect(bestDeposit.depositId).to.equal(1);
      expect(maxTokenAmount).to.equal(usdc(50).mul(ether(1)).div(ether(0.98)));
    });

    describe("when there is a processor filter", function () {
      beforeEach(async () => {
        subjectVerifier = otherVerifier.address;
      });

      it("should return the best rate among deposits for the processor", async () => {
        const [bestDeposit, maxTokenAmount] = await subject();

        expect(bestDeposit.depositId).to.equal(2);
        expect(maxTokenAmount).to.equal(usdc(50).mul(ether(1)).div(ether(0.99)));
      });
    });

    describe("when the currency is EUR", function () {
      beforeEach(async () => {
        subjectCurrency = Currency.EUR;
      });

      it("should return the best rate among deposits for the currency", async () => {
        const [bestDeposit, maxTokenAmount] = await subject();

        expect(bestDeposit.depositId).to.equal(5);
        expect(maxTokenAmount).to.equal(usdc(50).mul(ether(1)).div(ether(1.05)));
      });
    });

    describe("when the amount is less than intent minimum", function () {
      beforeEach(async () => {
        subjectAmount = usdc(17);
        subjectDepositIds = [ZERO, ONE];
      });

      it("should return the best rate among deposits for the currency", async () => {
        const [bestDeposit, maxTokenAmount] = await subject();

        expect(bestDeposit.depositId).to.equal(0);
        expect(maxTokenAmount).to.equal(usdc(17).mul(ether(1)).div(ether(1.5)));
      });
    });

    describe("when the amount is greater than intent maximum", function () {
      beforeEach(async () => {
        subjectAmount = usdc(100);
        subjectDepositIds = [ZERO, ONE];
      });

      it("should return the best rate among deposits for the currency", async () => {
        const [bestDeposit, maxTokenAmount] = await subject();

        expect(bestDeposit.depositId).to.equal(0);
        expect(maxTokenAmount).to.equal(usdc(100).mul(ether(1)).div(ether(1.5)));
      });
    });

    describe("when the amount is greater than ALL available liquidity", function () {
      beforeEach(async () => {
        subjectAmount = usdc(250);
        subjectDepositIds = [ZERO];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("No valid deposit found");
      });
    });

    describe("when the token is different", function () {
      beforeEach(async () => {
        subjectToken = dummyToken.address;
        subjectAmount = ether(100);
      });

      it("should return the best rate among deposits for the currency", async () => {
        const [bestDeposit, maxTokenAmount] = await subject();

        expect(bestDeposit.depositId).to.equal(3);
        expect(maxTokenAmount).to.equal(ether(100).mul(ether(1)).div(ether(1.1)));
      });
    });

    describe("when the order is filled", function () {
      beforeEach(async () => {
        subjectDepositIds = [ZERO, BigNumber.from(4)];
      });

      it("should return the deposit with the best rate", async () => {
        const [bestDeposit, maxTokenAmount] = await subject();

        expect(bestDeposit.depositId).to.equal(ZERO);
        expect(maxTokenAmount).to.equal(usdc(50).mul(ether(1)).div(ether(1.5)));
      });
    });

    describe("when the deposit is not accepting intents", function () {
      beforeEach(async () => {
        await ramp.connect(offRamper.wallet).withdrawDeposit(ONE);

        subjectDepositIds = [ZERO, ONE];
      });

      it("should return the deposit with the best rate", async () => {
        const [bestDeposit, maxTokenAmount] = await subject();

        expect(bestDeposit.depositId).to.equal(ZERO);
        expect(maxTokenAmount).to.equal(usdc(50).mul(ether(1)).div(ether(1.5)));
      });
    });

    describe("when the gating service is different", function () {
      beforeEach(async () => {
        subjectGatingService = gatingServiceOther.address;
      });

      it("should return the deposit with the best rate", async () => {
        const [bestDeposit, maxTokenAmount] = await subject();

        expect(bestDeposit.depositId).to.equal(6);
        expect(maxTokenAmount).to.equal(usdc(50).mul(ether(1)).div(ether(1.04)));
      });
    });

    describe("when the currency code is not provided", function () {
      beforeEach(async () => {
        subjectCurrency = ZERO_BYTES32;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Currency code must be provided");
      });
    });

    describe("when the deposit IDs array is empty", function () {
      beforeEach(async () => {
        subjectDepositIds = [];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Deposit IDs array cannot be empty");
      });
    });

    describe("when the token address is not provided", function () {
      beforeEach(async () => {
        subjectToken = ADDRESS_ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Token address must be provided");
      });
    });

    describe("when the amount is 0", function () {
      beforeEach(async () => {
        subjectAmount = ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Amount must be greater than 0");
      });
    });
  });

  describe("quoteMinFiatInputForExactTokenOutput", function () {
    let subjectDepositIds: BigNumber[];
    let subjectToken: Address;
    let subjectVerifier: Address;
    let subjectCurrency: string;
    let subjectAmount: BigNumber;
    let subjectGatingService: Address;

    beforeEach(async () => {
      await usdcToken.connect(offRamper.wallet).approve(ramp.address, usdc(10000));

      // Deposit 1: Worst rates for all verifiers
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(150),
        { min: usdc(10), max: usdc(200) },
        [verifier.address, otherVerifier.address],
        [
          {
            intentGatingService: gatingService.address,
            payeeDetailsHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payee1")),
            data: "0x",
          },
          {
            intentGatingService: gatingService.address,
            payeeDetailsHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payee1")),
            data: "0x",
          },
        ],
        [
          [
            { code: Currency.USD, conversionRate: ether(1.5) },
            { code: Currency.EUR, conversionRate: ether(1.6) },
            { code: Currency.GBP, conversionRate: ether(1.7) },
          ],
          [
            { code: Currency.USD, conversionRate: ether(1.6) },
            { code: Currency.EUR, conversionRate: ether(1.7) },
            { code: Currency.GBP, conversionRate: ether(1.8) },
          ],
        ]
      );

      // Deposit 2: Best rate for USD
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(200),
        { min: usdc(20), max: usdc(100) },
        [verifier.address],
        [
          {
            intentGatingService: gatingService.address,
            payeeDetailsHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payee2")),
            data: "0x",
          },
        ],
        [
          [{ code: Currency.USD, conversionRate: ether(0.98) }],
        ]
      );

      // Deposit 3: Best rate for alternative verifier
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(200),
        { min: usdc(20), max: usdc(100) },
        [otherVerifier.address],
        [
          {
            intentGatingService: gatingService.address,
            payeeDetailsHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payee3")),
            data: "0x",
          },
        ],
        [
          [{ code: Currency.USD, conversionRate: ether(0.99) }],
        ]
      );

      // Deposit 4: Different token
      const DummyTokenFactory = await ethers.getContractFactory("USDCMock");
      dummyToken = await DummyTokenFactory.deploy(
        ether(1000000),
        "DAI",
        "DAI"
      );

      await dummyToken.transfer(offRamper.address, ether(10000));
      await dummyToken.connect(offRamper.wallet).approve(ramp.address, ether(10000));

      await ramp.connect(offRamper.wallet).createDeposit(
        dummyToken.address,
        ether(300),
        { min: ether(30), max: ether(400) },
        [verifier.address],
        [
          {
            intentGatingService: gatingService.address,
            payeeDetailsHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payee4")),
            data: "0x",
          },
        ],
        [
          [{ code: Currency.USD, conversionRate: ether(1.1) }],
        ]
      );

      // Deposit 5 - Filled order
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(50),
        { min: usdc(30), max: usdc(50) },
        [verifier.address],
        [
          {
            intentGatingService: gatingService.address,
            payeeDetailsHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payee5")),
            data: "0x",
          },
        ],
        [
          [{ code: Currency.USD, conversionRate: ether(1.2) }],
        ]
      );

      await ramp.connect(onRamper.wallet).signalIntent(
        BigNumber.from(4),
        usdc(49),
        onRamper.address,
        verifier.address,
        Currency.USD,
        await generateGatingServiceSignature(
          BigNumber.from(4),
          usdc(49),
          onRamper.address,
          verifier.address,
          Currency.USD,
          chainId.toString()
        )
      );

      // Deposit 6: Different currency
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(200),
        { min: usdc(20), max: usdc(100) },
        [verifier.address],
        [
          {
            intentGatingService: gatingService.address,
            payeeDetailsHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payee6")),
            data: "0x",
          },
        ],
        [
          [{ code: Currency.EUR, conversionRate: ether(1.05) }],
        ]
      );

      // Deposit 7: Different gating service
      await ramp.connect(offRamper.wallet).createDeposit(
        usdcToken.address,
        usdc(200),
        { min: usdc(20), max: usdc(100) },
        [verifier.address],
        [
          {
            intentGatingService: gatingServiceOther.address,
            payeeDetailsHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("payee7")),
            data: "0x",
          },
        ],
        [
          [{ code: Currency.USD, conversionRate: ether(1.04) }],
        ]
      );

      subjectDepositIds = [
        ZERO,
        ONE,
        BigNumber.from(2),
        BigNumber.from(3),
        BigNumber.from(4),
        BigNumber.from(5),
        BigNumber.from(6),
        BigNumber.from(7)
      ];
      subjectToken = usdcToken.address;
      subjectVerifier = ADDRESS_ZERO;
      subjectCurrency = Currency.USD;
      subjectAmount = usdc(50);
      subjectGatingService = gatingService.address;
    });

    async function subject(): Promise<any> {
      return quoter.quoteMinFiatInputForExactTokenOutput(
        subjectDepositIds,
        subjectVerifier,
        subjectGatingService,
        subjectToken,
        subjectCurrency,
        subjectAmount
      );
    }

    it("should return the lowest USD rate among all deposits", async () => {
      const [bestDeposit, minFiatAmount] = await subject();

      expect(bestDeposit.depositId).to.equal(1);
      expect(minFiatAmount).to.equal(ether(0.98).mul(usdc(50)).div(ether(1)));
    });

    describe("when there is a processor filter", function () {
      beforeEach(async () => {
        subjectVerifier = otherVerifier.address;
      });

      it("should return the best rate among deposits for the processor", async () => {
        const [bestDeposit, minFiatAmount] = await subject();

        expect(bestDeposit.depositId).to.equal(2);
        expect(minFiatAmount).to.equal(ether(0.99).mul(usdc(50)).div(ether(1)));
      });
    });

    describe("when the currency is EUR", function () {
      beforeEach(async () => {
        subjectCurrency = Currency.EUR;
      });

      it("should return the best rate among deposits for the currency", async () => {
        const [bestDeposit, minFiatAmount] = await subject();

        expect(bestDeposit.depositId).to.equal(5);
        expect(minFiatAmount).to.equal(ether(1.05).mul(usdc(50)).div(ether(1)));
      });
    });

    describe("when the amount is less than intent minimum", function () {
      beforeEach(async () => {
        subjectAmount = usdc(17);
        subjectDepositIds = [ZERO, ONE];
      });

      it("should return the best rate among deposits for the currency", async () => {
        const [bestDeposit, minFiatAmount] = await subject();

        expect(bestDeposit.depositId).to.equal(0);
        expect(minFiatAmount).to.equal(ether(1.5).mul(usdc(17)).div(ether(1)));
      });
    });

    describe("when the amount is greater than intent maximum", function () {
      beforeEach(async () => {
        subjectAmount = usdc(101);
        subjectDepositIds = [ZERO, ONE];
      });

      it("should return the best rate among deposits for the currency", async () => {
        const [bestDeposit, minFiatAmount] = await subject();

        expect(bestDeposit.depositId).to.equal(0);
        expect(minFiatAmount).to.equal(ether(1.5).mul(usdc(101)).div(ether(1)));
      });
    });

    describe("when the amount is greater than ALL available liquidity", function () {
      beforeEach(async () => {
        subjectAmount = usdc(250);
        subjectDepositIds = [ZERO];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("No valid deposit found");
      });
    });

    describe("when the token is different", function () {
      beforeEach(async () => {
        subjectToken = dummyToken.address;
        subjectAmount = ether(100);
      });

      it("should return the best rate among deposits for the currency", async () => {
        const [bestDeposit, minFiatAmount] = await subject();

        expect(bestDeposit.depositId).to.equal(3);
        expect(minFiatAmount).to.equal(ether(1.1).mul(ether(100)).div(ether(1)));
      });
    });

    describe("when the order is filled", function () {
      beforeEach(async () => {
        subjectDepositIds = [ZERO, BigNumber.from(4)];
      });

      it("should return the deposit with the best rate", async () => {
        const [bestDeposit, minFiatAmount] = await subject();

        expect(bestDeposit.depositId).to.equal(ZERO);
        expect(minFiatAmount).to.equal(ether(1.5).mul(usdc(50)).div(ether(1)));
      });
    });

    describe("when the deposit is not accepting intents", function () {
      beforeEach(async () => {
        await ramp.connect(offRamper.wallet).withdrawDeposit(ONE);

        subjectDepositIds = [ZERO, ONE];
      });

      it("should return the deposit with the best rate", async () => {
        const [bestDeposit, minFiatAmount] = await subject();

        expect(bestDeposit.depositId).to.equal(ZERO);
        expect(minFiatAmount).to.equal(ether(1.5).mul(usdc(50)).div(ether(1)));
      });
    });

    describe("when the gating service is different", function () {
      beforeEach(async () => {
        subjectGatingService = gatingServiceOther.address;
      });

      it("should return the deposit with the best rate", async () => {
        const [bestDeposit, minFiatAmount] = await subject();

        expect(bestDeposit.depositId).to.equal(6);
        expect(minFiatAmount).to.equal(ether(1.04).mul(usdc(50)).div(ether(1)));
      });
    });

    describe("when the currency code is not provided", function () {
      beforeEach(async () => {
        subjectCurrency = ZERO_BYTES32;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Currency code must be provided");
      });
    });

    describe("when the deposit IDs array is empty", function () {
      beforeEach(async () => {
        subjectDepositIds = [];
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Deposit IDs array cannot be empty");
      });
    });

    describe("when the token address is not provided", function () {
      beforeEach(async () => {
        subjectToken = ADDRESS_ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Token address must be provided");
      });
    });

    describe("when the amount is 0", function () {
      beforeEach(async () => {
        subjectAmount = ZERO;
      });

      it("should revert", async () => {
        await expect(subject()).to.be.revertedWith("Amount must be greater than 0");
      });
    });
  });
});
