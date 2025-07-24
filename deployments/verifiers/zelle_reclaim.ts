import { BigNumber } from "ethers";
import { Currency } from "../../utils/protocolUtils";
import { hashProviderParams } from "@zkp2p/reclaim-witness-sdk";
import { ONE_DAY_IN_SECONDS } from "@utils/constants";

export const getZelleCitiReclaimProviderHashes = async (length: number) => {
  const hashes: string[] = [];
  for (let i = 0; i < length; i++) {
    const hashed = hashProviderParams(
      {
        url: "https://online.citi.com/gcgapi/prod/public/v1/p2ppayments/pastActivityTransactions?transactionCount=20&pageId=0&tab=All",
        method: "GET",
        body: "",
        responseMatches: [
          {
            "type": "regex",
            "value": "\"paymentID\":\"(?<paymentID>[^\"]+)\""
          },
          {
            "type": "regex",
            "value": "\"paymentStatus\":\"(?<paymentStatus>[^\"]+)\""
          },
          {
            "type": "regex",
            "value": "\"updatedTimeStamp\":\"(?<updatedTimeStamp>[^\"]+)\""
          },
          {
            "type": "regex",
            "value": "\"amount\":\"(?<amount>[^\"]+)\""
          },
          {
            "type": "regex",
            "value": "\"partyToken\":\"(?<partyToken>[^\"]+)\"",
            "hash": true
          }
        ],
        responseRedactions: [
          {
            "jsonPath": `$.content.paymentTransactionsData[${i}].paymentID`,
            "xPath": ""
          },
          {
            "jsonPath": `$.content.paymentTransactionsData[${i}].paymentStatus`,
            "xPath": ""
          },
          {
            "jsonPath": `$.content.paymentTransactionsData[${i}].updatedTimeStamp`,
            "xPath": ""
          },
          {
            "jsonPath": `$.content.paymentTransactionsData[${i}].amount`,
            "xPath": ""
          },
          {
            "jsonPath": `$.content.paymentTransactionsData[${i}].partyToken`,
            "xPath": ""
          }
        ],
      }
    );
    hashes.push(hashed);
  }
  return hashes;
}

export const getZelleChaseReclaimProviderHashes = async (length: number) => {
  const hashes: string[] = [];
  for (let i = 0; i < length; i++) {
    const listHashes = hashProviderParams(
      {
        url: "https://secure.chase.com/svc/rr/payments/secure/v1/quickpay/payment/activity/list",
        method: "POST",
        body: "pageId=&sortBy=PROCESS_DATE&orderBy=DESC",
        responseMatches: [
          {
            "type": "regex",
            "value": "\"id\":(?<id>[0-9]+)"
          },
          {
            "type": "regex",
            "value": "\"verboseStatus\":\"(?<verboseStatus>[^\"]+)\""
          },
          {
            "type": "regex",
            "value": "\"date\":\"(?<date>[^\"]+)\""
          },
          {
            "type": "regex",
            "value": "\"amount\":(?<amount>[0-9\\.]+)"
          }
        ],
        responseRedactions: [
          {
            "jsonPath": `$.listItems[${i}].id`,
            "xPath": ""
          },
          {
            "jsonPath": `$.listItems[${i}].verboseStatus`,
            "xPath": ""
          },
          {
            "jsonPath": `$.listItems[${i}].date`,
            "xPath": ""
          },
          {
            "jsonPath": `$.listItems[${i}].amount`,
            "xPath": ""
          }
        ],
      }
    );
    hashes.push(listHashes);
  }

  const detailsHash = hashProviderParams(
    {
      url: "https://secure.chase.com/svc/rr/payments/secure/v1/quickpay/payment/activity/detail/list",
      method: "POST",
      body: "paymentId={{PAYMENT_ID}}",
      responseMatches: [
        {
          "type": "regex",
          "value": "\"recipientEmail\":\"(?<recipientEmail>[^\"]+)\"",
          "hash": true
        }
      ],
      responseRedactions: [
        {
          "jsonPath": "$.recipientEmail"
        }
      ]
    }
  );
  hashes.push(detailsHash);

  return hashes;
}

export const getZelleBoAReclaimProviderHashes = async (length: number) => {
  const hashes: string[] = [];
  for (let i = 0; i < length; i++) {
    const hashed = hashProviderParams(
      {
        url: "https://secure.bankofamerica.com/ogateway/payment-activity/api/v4/activity",
        method: "POST",
        body: "{\"filterV1\":{\"dateFilter\":{\"timeframeForHistory\":\"DEFAULTDAYS\"}},\"sortCriteriaV1\":{\"fieldName\":\"DATE\",\"order\":\"DESCENDING\"},\"pageInfo\":{\"pageNum\":1,\"pageSize\":\"\"}}",
        responseMatches: [
          {
            "type": "regex",
            "value": "\"confirmationNumber\":\"(?<confirmationNumber>[^\"]+)\""
          },
          {
            "type": "regex",
            "value": "\"status\":\"(?<status>[^\"]+)\""
          },
          {
            "type": "regex",
            "value": "\"transactionDate\":\"(?<transactionDate>[^\"]+)\""
          },
          {
            "type": "regex",
            "value": "\"amount\":(?<amount>[0-9\\.]+)"
          },
          {
            "type": "regex",
            "value": "\"aliasToken\":\"(?<aliasToken>[^\"]+)\"",
            "hash": true
          }
        ],
        responseRedactions: [
          {
            "jsonPath": `$.completedTransactions[${i}].confirmationNumber`,
            "xPath": ""
          },
          {
            "jsonPath": `$.completedTransactions[${i}].status`,
            "xPath": ""
          },
          {
            "jsonPath": `$.completedTransactions[${i}].transactionDate`,
            "xPath": ""
          },
          {
            "jsonPath": `$.completedTransactions[${i}].amount`,
            "xPath": ""
          },
          {
            "jsonPath": `$.completedTransactions[${i}].targetAccount.aliasToken`,
            "xPath": ""
          }
        ],
      }
    );
    hashes.push(hashed);
  }
  return hashes;
}

export const ZELLE_APPCLIP_PROVIDER_HASHES = []

export const ZELLE_RECLAIM_CURRENCIES: any = [
  Currency.USD
];

// Date: 24 July 2025
export const ZELLE_CITI_OLD_EXTENSION_PROVIDER_HASHES = [
  '0x611427d0224e99f0981060239894356dc4c3494f95eb9d139f9a402b130a9ad4',
  '0x3a3d23f3f3c5063af7fa0bd48aa98f4cd4658770aa5de971924fda7ef92ea743',
  '0x2a20d5d1fc3ccfa7f3053949fb067cb56447eb46cb415a10a496c36c5f9992d7',
  '0x1b2242ae270803ed3a0e3a71ea349013ec11a963283cd2b49225732155d9d669',
  '0x860f8b1feab450c110f88e8bf983a10ec470b3818f855635574871491d6de5fa',
  '0x0543afb5589ce0d9f4d0df461871820b3cc1f584d4e5e877dcc5a1fd8edbc900',
  '0x1898578b6c6320260bfa4f9717c2f529e53e74908405f32612d2c2612287cede',
  '0x532a1cde992553a1d73b6531b1ad8e163277486c831ebd1c9131ed2e20599f1e',
  '0xed23a57df2ed4a5d82d471ac4592380e0388bdc0a7a79b5844347cc4e1c6a134',
  '0x3ff906c52f9e9b446d294a35315953330b633dbba4b294ab222f060911e06e6c',
  '0x04cbc588ec74f2b8564fff743ff918fcb80e05d9081e6c6e2a5af8f21516885f',
  '0xf9bfbf3c277f0db3b59a1fc164e84fc096107cb3cf2d2717ff3a572644c17491',
  '0x8530dec46be3196b90044f8bb90ab69e7fdf9ccd6742eebd6c534dc9fa92953d',
  '0xc5a63db7cc0eaee9d3c2cc13caf4f16c878bc36e027b33c7e0731e71dbda73c1',
  '0x488098e92ae73d56b930f79217fa48877a8fd6b7d8ad337ea1f402f3d3ac1bcc',
  '0x39a45df78a1b4799a5a45c1a4ef1102d7873e6e160420719fdeec934372d4329',
  '0x716b3dae20b1b53804695d74be7e70f6d68f444ebcaae588c533f84e60fb3ec3',
  '0xba85f06a8d4fbbea51492788be36b7d06232fdccc866295c95f9dde18b09ec9f',
  '0x3c412cf774a4d18184e711fb33884c9929401433a00892afc97b1d94777ec7e3',
  '0x6296951a4ebed6beb817292c4c70ca7645abfd46efeb8f52a325ed0b37d21bf3'
]

// Date: 24 July 2025
export const ZELLE_CHASE_OLD_EXTENSION_PROVIDER_HASHES = [
  '0xc472a6b6bace68cef2750c5a713a9649b3a89965d2e7a7c81d8301987f281200',
  '0xced280486908345bea56fbd00f9b39e0cd8a626a20376763d75bbe52c17b6846',
  '0xd7615f705f999e8db7b0c9c2a16849559b88f3b95d6bdeed8a8c106bee870046',
  '0x30725b5ebd9a8e1663733b8435a1da9c59a3647492c61174c43997de334e2f61',
  '0x718ae48aa1d0aa333693d50c8817ec4a45796e0a6f0ea14ebe868b2e081ff5a3',
  '0xeead4659a0a0363e400adf96b60a10a608d11a0280f8f560f175e7a923ffaf35',
  '0x7ba04e25e6f642339eb1ff5dc2ed49ed4c6f79ec68c0c7ad3f81c1605cc66102',
  '0xe35bca0c85c889471a4979efcbb747cdbbf7b273640d4794303b4247b2fa99de',
  '0xb8f3603a04c623930ef5ceff5d4dd7cc749114989b5e34565dac358835cc1a77',
  '0xf2b6fdfaefd6964bcb202ab6886b80a51e061533c3bed39429eab887cc68a6d9',
  '0x0f50cfe682d82acfcff1140cfca303d627a9d468764cfa401611d476695ce6cd'
]

// Date: 24 July 2025
export const ZELLE_BOA_OLD_EXTENSION_PROVIDER_HASHES = [
  '0x05eecaa422b995a513376f7ae0b3a16fab2bdcb7fb1eff38891475b56869a1bd',
  '0x7590feb5bf279eb5f0dbd6e419f29d3af8ec99dbdef405337758dbab813b83ac',
  '0x224453b6c54ab9d24d4d3c44c65fd41bf7c688d0a2945764c69097bb4096a232',
  '0x0f311d08ccd33835f7aaaaa1a3bd5f9bc8842f62b5e6f6016774d598209d81a6',
  '0x7063a969be444967642532977090a320c346eb0b9c0e37ebfcfe3c075f9f3f9e',
  '0x82667fe5517814d3ba3f4b6baa47913e436aa7ffcd051b4a66b24f0c66e3ea29',
  '0x17e8e900bdf8b54faeb3f04183993df5dd31367c7fa29e6b904ef8946c4372e8',
  '0x6fcd28cfd89f1ccb063574ec30d12ab46051920b2f44fafea9d140ef41fbc6a8',
  '0x43a10fdadcfd24fcc159d592bde69210afc955a3f62a89d42beb1c3bf59fc005',
  '0x85a910986d8579cea44c77b86877bf34615ea03bca2c5401e275463d669adbdb'
]


export const ZELLE_RECLAIM_TIMESTAMP_BUFFER = {
  'citi': ONE_DAY_IN_SECONDS,
  'chase': ONE_DAY_IN_SECONDS,
  'bofa': ONE_DAY_IN_SECONDS,
}

export const ZELLE_RECLAIM_FEE_SHARE: any = {
  "base": BigNumber.from(0),  // 0% of sustainability fee
  "base_staging": BigNumber.from(0),  // 0% of sustainability fee
  "sepolia": BigNumber.from(0),  // 0% of sustainability fee 
  "localhost": BigNumber.from(0),  // 0% of sustainability fee
  "base_sepolia": BigNumber.from(0),  // 0% of sustainability fee
}
