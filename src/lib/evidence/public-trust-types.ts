export type PublicTrustStat = {
  label: string;
  value: string;
  detail?: string;
};

export type PublicTrustStats = {
  stats: PublicTrustStat[];
  source: "evidence" | "product";
};
