import { BigNumber } from "ethers";
import { Currency } from "../../utils/protocolUtils";
import { hashProviderParams } from "@zkp2p/reclaim-witness-sdk";

export const getRevolutReclaimProviderHashes = async (length: number) => {
  const hashes = [];
  for (let i = 0; i < length; i++) {
    const hashed = hashProviderParams(
      {
        url: "https://app.revolut.com/api/retail/user/current/transactions/last?count=20",
        method: "GET",
        body: "",
        responseMatches: [
          {
            "type": "regex",
            "value": `"amount":(?<amount>[0-9\\-]+)`,
          },
          {
            "type": "regex",
            "value": `"completedDate":(?<completedDate>[0-9]+)`,
          },
          {
            "type": "regex",
            "value": `"currency":"(?<currency>[^"]+)"`,
          },
          {
            "type": "regex",
            "value": `"id":"(?<id>[^"]+)"`,
          },
          {
            "type": "regex",
            "value": `"state":"(?<state>[^"]+)"`,
          },
          {
            "type": "regex",
            "value": `"username":"(?<username>[^"]+)"`,
            "hash": true
          },
        ],
        responseRedactions: [
          {
            "jsonPath": `$.[${i}].amount`,
            "xPath": ""
          },
          {
            "jsonPath": `$.[${i}].completedDate`,
            "xPath": ""
          },
          {
            "jsonPath": `$.[${i}].currency`,
            "xPath": ""
          },
          {
            "jsonPath": `$.[${i}].id`,
            "xPath": ""
          },
          {
            "jsonPath": `$.[${i}].recipient.username`,
            "xPath": ""
          },
          {
            "jsonPath": `$.[${i}].state`,
            "xPath": ""
          },
        ]
      }
    )
    hashes.push(hashed);
  }
  return hashes;
};

export const REVOLUT_RECLAIM_CURRENCIES: any = [
  Currency.USD,
  Currency.EUR,
  Currency.GBP,
  Currency.SGD,
  Currency.NZD,
  Currency.AUD,
  Currency.CAD,
  Currency.JPY,
  Currency.HKD,
  Currency.MXN,
  Currency.SAR,
  Currency.AED,
  Currency.THB,
  Currency.TRY,
  Currency.PLN,
  Currency.CHF,
  Currency.ZAR,
  Currency.NOK,
  Currency.CZK,
  Currency.DKK,
  Currency.SEK,
  Currency.RON,
  Currency.HUF,
  Currency.CNY,
];

export const REVOLUT_OLD_APPCLIP_PROVIDER_HASHES = [
  "0x1aab313df15d1b43710e53ed95b1b6118305aa9312f28b747c6c16cf574fb616"
]

export const REVOLUT_APPCLIP_PROVIDER_HASHES = [
  "0x532fa878704447443de809fdda796bc94b65a0dc14f5de4374de88420d928b5a"
]

// Date: 24 July 2025
export const REVOLUT_OLD_EXTENSION_PROVIDER_HASHES = [
  '0xf7a51cf627a9d9aad6f9b838e2251f857bad61356ab17a923f08c84fdc1d304e',
  '0xe0d6623ce129c5a9c9f042d2a8a8d8956b5bb994235920e0f2774874716bf0c8',
  '0x08274b815644b0bb33991923fd53561db52457831a26af0a7069383127cc0b33',
  '0x38aecffa2d40dd83d076b558471cd4e80cee1c8961ca107d9ba22cfb6950cb49',
  '0x314cf5bd678564f25e2eb29e234546f20df3ccf1c73ea1d5ab2289a4ccc164e4',
  '0xfac7afc5bdea65acf72152c68f117936823d379510ed92d2426e2616a21de704',
  '0xf44e366635c7f39be0b96d93e9a8234677ce6600b17feb9fc7e605fd31292c31',
  '0x41cf635a03a2939e1a093278eb33d45261bd7e66f9793586ef56a2a9f4eb3f34',
  '0x7edb58e9e77ae2971590b9e42f12af58c1e9bec8966cb21a2b877940580f5711',
  '0x2cb9fa7e6fab5c3ef1dcf6e8be16948939fbd5108ee4b579fe344ba799237720',
  '0xb7f781f313b05abd1218bd77ee9cfa5f0a49c384d50f7aa0a9605a36bce50887',
  '0xd6f96db3e4b62e640034e44710d8967ebf07232d2acb293186c072f911e52ff6',
  '0xfbc202a6883918fbcf632b05d25760684ce1d0c16e39bdf5080e28488c058c00',
  '0x630c30d69b11212f6b2bf33ea7924b15ac52c91323e7193cfd372e11238f5e38',
  '0xd2f06fdb5e84b710413c13bb24933b544e4881377990d08abd965180c0a3c51a',
  '0xbf83d06846e91d166dc4456d8fe8046cfda02ac17f80db7744b12ccea8e3a577',
  '0x52114cf7aa4b3995f061f59a3f3d58368c79f50365ada2774fede119c32189dc',
  '0x0a996733d70c836caa4b9797d3d9ebb527841b248c598d0d12574676bf637841',
  '0xf52fb41cd65697eb9fdaba738750064b689f343ecb1c7c39b323ae6f7c34e390',
  '0x87ae87ae4cc5eff1ac446ef38d12ea935d503fadd91bd98d4099f46391a5e4ef'
]

export const REVOLUT_RECLAIM_TIMESTAMP_BUFFER = BigNumber.from(30);   // 30 seconds

export const REVOLUT_RECLAIM_FEE_SHARE: any = {
  "base": BigNumber.from(0),  // 0% of sustainability fee
  "base_staging": BigNumber.from(30),  // 30% of sustainability fee
  "sepolia": BigNumber.from(30),  // 30% of sustainability fee 
  "localhost": BigNumber.from(0),  // 0% of sustainability fee
  "base_sepolia": BigNumber.from(0),  // 0% of sustainability fee
}