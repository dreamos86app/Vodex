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

export type CustomDomainDnsRecords = {
  cname: { type: "CNAME"; name: string; host: string; value: string };
  txt: { type: "TXT"; name: string; host: string; value: string };
  apexRedirectNote?: string;
  inputHostname?: string;
};

/** Apex = registrable root (example.com). CNAME cannot target apex — use www. */
export function isApexHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  const parts = host.split(".").filter(Boolean);
  return parts.length === 2;
}

/** Normalize user input: apex domains become www.{apex} for CNAME verification. */
export function normalizeCustomDomainHostname(raw: string): {
  inputHostname: string;
  hostname: string;
  isApex: boolean;
} {
  const inputHostname = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    ?.replace(/\.$/, "") ?? "";
  const isApex = isApexHostname(inputHostname);
  const hostname = isApex ? `www.${inputHostname}` : inputHostname;
  return { inputHostname, hostname, isApex };
}

/** DNS provider "Name" column — subdomain label only, never the full apex domain. */
export function dnsRecordLabel(hostname: string): string {
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length <= 2) return "www";
  return parts[0] ?? hostname;
}

export async function verifyCustomDomainDns(
  hostname: string,
  verificationToken: string,
): Promise<DnsVerificationResult> {
  const host = hostname.trim().toLowerCase();
  const errors: string[] = [];
  const txtRecords: string[] = [];
  const cnameRecords: string[] = [];

  let txtVerified = false;
  const txtHost = `_vodex.${host}`;
  try {
    const txts = await dns.resolveTxt(txtHost);
    for (const row of txts) {
      const joined = row.join("");
      txtRecords.push(joined);
      if (joined === `${TXT_PREFIX}${verificationToken}`) txtVerified = true;
    }
  } catch {
    errors.push(`TXT record not found at ${txtHost}`);
  }

  let cnameVerified = false;
  try {
    const cnames = await dns.resolveCname(host);
    cnameRecords.push(...cnames);
    cnameVerified = cnames.some((c) => c.toLowerCase().replace(/\.$/, "") === CNAME_TARGET);
  } catch {
    errors.push(`CNAME on ${host} should point to ${CNAME_TARGET}`);
  }

  return {
    txtVerified,
    cnameVerified,
    records: { txt: txtRecords, cname: cnameRecords },
    errors,
  };
}

export function buildCustomDomainDnsInstructions(
  hostname: string,
  token: string,
): CustomDomainDnsRecords {
  const normalized = normalizeCustomDomainHostname(hostname);
  const host = normalized.hostname;
  const cnameName = dnsRecordLabel(host);
  const txtName = `_vodex.${cnameName}`;

  return {
    inputHostname: normalized.inputHostname,
    cname: { type: "CNAME", name: cnameName, host, value: CNAME_TARGET },
    txt: {
      type: "TXT",
      name: txtName,
      host: `_vodex.${host}`,
      value: `${TXT_PREFIX}${token}`,
    },
    apexRedirectNote: normalized.isApex
      ? `Root domains cannot use CNAME. Add records for ${host}, then redirect ${normalized.inputHostname} → ${host} at your registrar.`
      : undefined,
  };
}
