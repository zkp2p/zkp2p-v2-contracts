import { task } from "hardhat/config";
import { getDeployedContractAddress } from "../deployments/helpers";

import { getCurrencyCodeFromHash } from "../utils/protocolUtils";

// > npx hardhat log-currencies --chain base_staging --network base_staging

export const logCurrencies = task("log-currencies", "Logs all supported currencies for each verifier")
  .addParam("chain", "The chain to use", "localhost")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const chain = taskArgs.chain;

    // Get verifier contracts
    const venmoVerifier = await ethers.getContractAt(
      "VenmoReclaimVerifier",
      getDeployedContractAddress(chain, "VenmoReclaimVerifier")
    );
    const revolutVerifier = await ethers.getContractAt(
      "RevolutReclaimVerifier",
      getDeployedContractAddress(chain, "RevolutReclaimVerifier")
    );
    const cashappVerifier = await ethers.getContractAt(
      "CashappReclaimVerifier",
      getDeployedContractAddress(chain, "CashappReclaimVerifier")
    );
    const wiseVerifier = await ethers.getContractAt(
      "WiseReclaimVerifier",
      getDeployedContractAddress(chain, "WiseReclaimVerifier")
    );

    console.log("\nSupported currencies by verifier:");

    // Log Venmo currencies
    console.log("\nVenmo Verifier:");
    const venmoSupportedCurrencies = await venmoVerifier.getCurrencies();
    venmoSupportedCurrencies.forEach((currency) => {
      console.log(`- ${getCurrencyCodeFromHash(currency)} - ${currency}`);
    });

    // Log Revolut currencies
    console.log("\nRevolut Verifier:");
    const revolutSupportedCurrencies = await revolutVerifier.getCurrencies();
    revolutSupportedCurrencies.forEach((currency) => {
      console.log(`- ${getCurrencyCodeFromHash(currency)} - ${currency}`);
    });

    // Log Cashapp currencies
    console.log("\nCashapp Verifier:");
    const cashappSupportedCurrencies = await cashappVerifier.getCurrencies();
    cashappSupportedCurrencies.forEach((currency) => {
      console.log(`- ${getCurrencyCodeFromHash(currency)} - ${currency}`);
    });

    // Log Wise currencies
    console.log("\nWise Verifier:");
    const wiseSupportedCurrencies = await wiseVerifier.getCurrencies();
    wiseSupportedCurrencies.forEach((currency) => {
      console.log(`- ${getCurrencyCodeFromHash(currency)} - ${currency}`);
    });
  });
