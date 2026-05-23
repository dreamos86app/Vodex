import { NextResponse } from "next/server";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import {
  aggregateScores,
  categoriesBelow,
  scoreAllCategories,
} from "@/lib/competitive/dreamos-readiness-score";
import { readEvidenceArtifact } from "@/lib/competitive/benchmark-evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const owner = await requireDreamosOwner();
  if (owner.error) return owner.error;

  const artifact = readEvidenceArtifact();
  const scored = scoreAllCategories(artifact);
  const agg = aggregateScores(scored);
  const below90 = categoriesBelow(90, scored);
  const below100 = categoriesBelow(100, scored);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    artifact,
    aggregate: agg,
    categories: scored.map((c) => ({
      id: c.id,
      index: c.index,
      title: c.title,
      dreamosBaseScore: c.dreamosScore,
      cappedScore: c.cappedScore,
      lovableScore: c.lovableScore,
      lovableSource: c.lovableSource,
      base44Score: c.base44Score,
      base44Source: c.base44Source,
      winner: c.winner,
      riskLevel: c.riskLevel,
      blockers: c.blockers,
      hasE2eProof: c.hasE2eProof,
      hasVerifyProof: c.hasVerifyProof,
      hasStubRisk: c.hasStubRisk,
      proofArtifact: c.proofArtifact,
      evidencePaths: c.evidencePaths,
      verifyCommands: c.verifyCommands,
      e2eSpec: c.e2eSpec,
      fixToReach100: c.fixToReach100,
    })),
    below90Count: below90.length,
    below100Count: below100.length,
    scoringRules: [
      "Max 85 without E2E proof for category",
      "Max 90 with stub/missing evidence",
      "Max 100 only with proof artifact + E2E where required",
      "Lovable/Base44 scores are estimated unless marked measured",
    ],
  });
}
