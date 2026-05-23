/**
 * Fixture tests for UI quality gate — run via verify-ui-quality.mjs (tsx).
 */
import { formatBlueprintForBuild } from "../src/lib/build/format-blueprint-prompt";
import { stylePresetBlocksDiffer } from "../src/lib/generation/design-token-presets";
import {
  reviewGeneratedUi,
  uiQualityBlocksGenerated,
  passesUiQualityGate,
} from "../src/lib/generation/generated-ui-review";
import { UI_QUALITY_THRESHOLDS } from "../src/lib/generation/ui-quality-spec";
import { parseAppBlueprint } from "../src/lib/build/blueprint-schema";

const PLACEHOLDER_FILES = [
  {
    path: "app/page.tsx",
    content: `export default function Page() {
  return <main><h1>Welcome</h1><p>Coming soon — TODO: implement dashboard</p></main>;
}`,
  },
  { path: "package.json", content: '{"name":"app","dependencies":{"react":"19"}}' },
];

const CRM_FILES = [
  {
    path: "app/contacts/page.tsx",
    content: `export default function Contacts() {
  return (
    <div className="flex flex-col md:flex-row gap-4 p-4 sm:p-6 min-h-screen bg-slate-50">
      <nav className="sidebar border-r p-4"><Link href="/deals">Deals</Link></nav>
      <main className="flex-1 space-y-4">
        <input placeholder="Search contacts" className="border rounded-lg px-3 py-2 text-sm" onChange={() => {}} />
        <div className="card rounded-lg shadow-sm border p-4 bg-white">Contact list</div>
        <form onSubmit={() => {}}><button type="submit" className="bg-blue-700 text-white rounded-md px-3 py-1.5 text-sm">Add contact</button></form>
        <div className="empty text-sm text-slate-600">No contacts yet — get started</div>
        <div className="loading skeleton animate-pulse">Loading</div>
        <div className="error text-red-600">Something went wrong — try again</div>
      </main>
    </div>
  );
}`,
  },
  {
    path: "app/deals/page.tsx",
    content: `export default function Deals() {
  return (
    <section className="p-4 sm:p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Deal pipeline</h1>
      <div className="task follow-up card border rounded-md p-4">Tasks and follow-up</div>
      <table className="w-full text-sm"><thead><tr><th>Stage</th></tr></thead><tbody><tr><td>Qualified</td></tr></tbody></table>
    </section>
  );
}`,
  },
  {
    path: "app/dashboard/page.tsx",
    content: `export default function Dash() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 sm:p-6">
      <div className="metric card stat bg-slate-50 border rounded-md p-4 text-sm font-medium">Revenue</div>
      <div className="metric card stat bg-slate-50 border rounded-md p-4">Patients</div>
      <div className="metric card stat bg-slate-50 border rounded-md p-4">Appointments</div>
    </div>
  );
}`,
  },
  { path: "package.json", content: '{"name":"crm","dependencies":{"react":"19"}}' },
];

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// Placeholder apps must not pass
const placeholderScore = reviewGeneratedUi({ files: PLACEHOLDER_FILES, appType: "crm" });
assert(uiQualityBlocksGenerated(placeholderScore), "placeholder app must block generated");
assert(placeholderScore.placeholderLike, "placeholder app flagged placeholderLike");
assert(placeholderScore.dimensions.placeholderRisk < 70, "placeholder risk must be high");
assert(!passesUiQualityGate({ files: PLACEHOLDER_FILES, appType: "crm" }), "placeholder fails gate");

// CRM fixture should pass gate at 80+
const crmScore = reviewGeneratedUi({
  files: CRM_FILES,
  appType: "crm",
  stylePresetId: "enterprise",
  routeMap: ["/contacts", "/deals", "/dashboard"],
});
assert(!uiQualityBlocksGenerated(crmScore), `CRM fixture should pass UI gate (score ${crmScore.overall})`);
assert(crmScore.overall >= UI_QUALITY_THRESHOLDS.minOverall, `CRM overall too low: ${crmScore.overall}`);
assert(crmScore.appTypeScore >= UI_QUALITY_THRESHOLDS.minAppTypeCompliance, `CRM app-type score too low: ${crmScore.appTypeScore}`);
assert(crmScore.passesGate, "CRM passesGate must be true");

// Style preset blocks differ
assert(stylePresetBlocksDiffer(), "minimal/bold/glass/enterprise prompt blocks must differ");

// stylePresetId reaches blueprint + build prompt
const bp = parseAppBlueprint({
  appName: "Test CRM",
  appType: "crm",
  oneSentencePitch: "CRM for teams",
  targetUsers: "Sales teams",
  primaryUserJobs: ["Track contacts", "Manage deals"],
  pages: [{ route: "/contacts", purpose: "Contacts list" }],
  routeMap: [{ route: "/contacts", purpose: "Contacts" }],
  authModel: "email",
  designSystem: "Tailwind",
  responsiveStrategy: "mobile-first",
  estimatedComplexity: 5,
  estimatedUserCredits: 20,
  qualityLevel: "standard",
  sourceMode: "llm_enriched",
  buildStages: ["ui", "data"],
  designDirection: "Clean enterprise CRM",
});
assert(bp.ok, "blueprint parse");
if (!bp.ok) throw new Error("blueprint parse failed");
const minimalBlock = formatBlueprintForBuild(bp.blueprint, { stylePresetId: "minimal" });
const boldBlock = formatBlueprintForBuild(bp.blueprint, { stylePresetId: "bold" });
assert(minimalBlock.includes("minimal") || minimalBlock.includes("Minimal"), "stylePresetId in minimal blueprint block");
assert(boldBlock.includes("bold") || boldBlock.includes("Bold"), "stylePresetId in bold blueprint block");
assert(minimalBlock !== boldBlock, "style preset must change blueprint build prompt");
assert(minimalBlock.includes("APP-TYPE REQUIREMENTS"), "app-type block in build prompt");
assert(minimalBlock.includes("UI QUALITY REQUIREMENTS"), "UI quality block in build prompt");

console.log("ui-quality fixture tests ok");
