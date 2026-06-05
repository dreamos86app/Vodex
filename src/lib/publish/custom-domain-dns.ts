import "server-only";

import dns from "node:dns/promises";

const CNAME_TARGET = process.env.VODEX_CUSTOM_DOMAIN_CNAME?.trim() || "cname.vodex.dev";
const TXT_PREFIX = "vodex-verify=";

export type DnsVerificationResult = {
  txtVerified: boolean;
  cnameVerified: boolean;
  records: { txt: string[]; cname: string[] };
  errors: string[];
};

export async function verifyCustomDomainDns(
  hostname: string,
  verificationToken: string,
): Promise<DnsVerificationResult> {
  const host = hostname.trim().toLowerCase();
  const errors: string[] = [];
  const txtRecords: string[] = [];
  const cnameRecords: string[] = [];

  let txtVerified = false;
  try {
    const txts = await dns.resolveTxt(`_vodex.${host}`);
    for (const row of txts) {
      const joined = row.join("");
      txtRecords.push(joined);
      if (joined === `${TXT_PREFIX}${verificationToken}`) txtVerified = true;
    }
  } catch {
    errors.push("TXT record not found at _vodex." + host);
  }

  let cnameVerified = false;
  try {
    const cnames = await dns.resolveCname(host);
    cnameRecords.push(...cnames);
    cnameVerified = cnames.some((c) => c.toLowerCase().replace(/\.$/, "") === CNAME_TARGET);
  } catch {
    try {
      const cnames = await dns.resolveCname(`www.${host}`);
      cnameRecords.push(...cnames);
      cnameVerified = cnames.some((c) => c.toLowerCase().replace(/\.$/, "") === CNAME_TARGET);
    } catch {
      errors.push(`CNAME should point to ${CNAME_TARGET}`);
    }
  }

  return {
    txtVerified,
    cnameVerified,
    records: { txt: txtRecords, cname: cnameRecords },
    errors,
  };
}

export function buildCustomDomainDnsInstructions(hostname: string, token: string) {
  return {
    cname: { host: hostname, type: "CNAME", value: CNAME_TARGET },
    txt: { host: `_vodex.${hostname}`, type: "TXT", value: `${TXT_PREFIX}${token}` },
    apexNote:
      "For apex domains (example.com), use your DNS provider ALIAS/ANAME or redirect to www.",
  };
}
