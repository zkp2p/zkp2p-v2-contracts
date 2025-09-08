import { hashProviderParams } from "@zkp2p/reclaim-witness-sdk";

type ResponseMatch = {
  type: string;
  value: string;
  // Some templates include extra keys like `hash`; keep them permissive
  [k: string]: any;
};

type ResponseRedaction = {
  jsonPath?: string;
  xPath?: string;
  regex?: string;
  [k: string]: any;
};

export type ProviderTemplateSubset = {
  url: string;
  method: string;
  body?: string;
  responseMatches: ResponseMatch[];
  responseRedactions: ResponseRedaction[];
  additionalProofs?: ProviderTemplateSubset[];
};

// Narrow a raw JSON provider template to the fields used by hashing
export function toSubset(template: any): ProviderTemplateSubset {
  const subset: ProviderTemplateSubset = {
    url: template.url,
    method: template.method,
    body: template.body || "",
    responseMatches: Array.isArray(template.responseMatches) ? template.responseMatches : [],
    responseRedactions: Array.isArray(template.responseRedactions) ? template.responseRedactions : [],
  };
  if (Array.isArray(template.additionalProofs)) {
    subset.additionalProofs = template.additionalProofs.map((p: any) => toSubset(p));
  }
  return subset;
}

function replaceIndexPlaceholders(value: any, index: number): any {
  if (value == null) return value;
  if (typeof value === "string") {
    // Replace both {{INDEX}} and {{ INDEX }} just in case
    return value.replace(/\{\{\s*INDEX\s*\}\}/g, String(index));
  }
  if (Array.isArray(value)) return value.map((v) => replaceIndexPlaceholders(v, index));
  if (typeof value === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) out[k] = replaceIndexPlaceholders(v, index);
    return out;
  }
  return value;
}

function buildHashInput(template: ProviderTemplateSubset, index?: number) {
  const t = index === undefined ? template : (replaceIndexPlaceholders(template, index) as ProviderTemplateSubset);
  return {
    url: t.url,
    method: t.method,
    body: t.body || "",
    responseMatches: t.responseMatches || [],
    responseRedactions: t.responseRedactions || [],
  };
}

export function hashSingle(template: ProviderTemplateSubset, index?: number): string {
  return hashProviderParams(buildHashInput(template, index));
}

export type HashListOptions = {
  // If true, hash each additional proof once (default). If false, ignore.
  includeAdditionalProofsOnce?: boolean;
};

// Hash list-style providers by materializing {{INDEX}} in selectors/redactions.
export function hashListProvider(
  template: ProviderTemplateSubset,
  count: number,
  options: HashListOptions = { includeAdditionalProofsOnce: true }
): string[] {
  const hashes: string[] = [];
  for (let i = 0; i < count; i++) {
    hashes.push(hashSingle(template, i));
  }

  if (options.includeAdditionalProofsOnce && Array.isArray(template.additionalProofs)) {
    for (const proof of template.additionalProofs) {
      // Mirror legacy behavior (e.g., Zelle/Chase): add each details proof once
      hashes.push(hashSingle(proof));
    }
  }

  return hashes;
}

// Convenience: compute hashes directly from raw JSON template.
export function computeProviderHashesFromJson(templateJson: any, count: number, options?: HashListOptions): string[] {
  return hashListProvider(toSubset(templateJson), count, options);
}

