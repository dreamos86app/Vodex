#!/usr/bin/env npx tsx
/**
 * Verify TODO/stub gate does not false-positive substantial multi-route apps.
 */
import { validateGeneratedApp } from "../src/lib/build/generated-app-validator";
import { applyTodoStubGate, detectTodoStubMatches } from "../src/lib/build/todo-stub-detector";
import { classifyPreviewBuildFailure } from "../src/lib/preview/preview-failure-classifier";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const substantialAppFiles = [
  {
    path: "package.json",
    content: JSON.stringify({
      name: "bidnest",
      dependencies: { react: "^18.0.0", "react-dom": "^18.0.0", next: "^14.0.0" },
      scripts: { dev: "next dev", build: "next build" },
    }),
  },
  {
    path: "app/layout.tsx",
    content: `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-white">{children}</body>
    </html>
  );
}`,
  },
  {
    path: "app/page.tsx",
    content: `export default function Home() {
  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-3xl font-bold">BidNest Auctions</h1>
      <p className="mt-4 text-slate-300">Browse live auctions and place bids in real time.</p>
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {["Vintage Watch", "Art Print", "Guitar"].map((item) => (
          <article key={item} className="rounded-xl border border-white/10 p-4">{item}</article>
        ))}
      </section>
    </main>
  );
}`,
  },
  ...Array.from({ length: 14 }, (_, i) => ({
    path: `app/routes/route-${i + 1}/page.tsx`,
    content: `export default function Route${i + 1}() {
  // TODO: refine filters later
  return <div className="p-8"><h2 className="text-xl font-semibold">Route ${i + 1}</h2><p>Live bidding tools and watchlists.</p></div>;
}`,
  })),
];

// 62-file scale: secondary TODO comments must not block
const validation = validateGeneratedApp({
  files: substantialAppFiles,
  projectId: "p1",
  ownerId: "u1",
});
assert(!validation.reasons.includes("todo_or_stub_page"), "substantial app must not get bare todo_or_stub_page");
assert(validation.ok || !validation.reasons.some((r) => r.startsWith("todo_or_stub_page")), "no blocking stub on substantial app");

const gate = applyTodoStubGate({
  files: substantialAppFiles,
  fileCount: substantialAppFiles.length,
  routeCount: 15,
});
assert(!gate.scan.shouldBlockPreview, "substantial app should not block preview for secondary TODOs");

// Primary stub must block
const stubPrimary = [
  ...substantialAppFiles.filter((f) => f.path !== "app/page.tsx"),
  { path: "app/page.tsx", content: "// TODO: implement home page" },
];
const stubGate = applyTodoStubGate({ files: stubPrimary, fileCount: stubPrimary.length, routeCount: 15 });
assert(stubGate.scan.shouldBlockPreview, "primary stub must block");
assert(stubGate.blockingReasons[0]?.includes("app/page.tsx"), "blocking reason must include file path");

// Classifier: no worker job + todo_or_stub => source validation, not generic build failed
const classified = classifyPreviewBuildFailure({
  appFilesCount: 62,
  routesCount: 16,
  packageJsonExists: true,
  entrypointExists: true,
  previewArtifactExists: false,
  buildLogs: null,
  userMessage: "todo_or_stub_page:app/page.tsx",
  previewStatus: "failed",
  previewBuildJobId: null,
});
assert(
  classified.failure_kind === "preview_source_validation_failed",
  `expected preview_source_validation_failed, got ${classified.failure_kind}`,
);
assert(classified.failing_file === "app/page.tsx", "classifier must expose failing file");

// Thin app with only stub root still blocks
const thinStub = [
  { path: "package.json", content: '{"dependencies":{"react":"18"}}' },
  { path: "app/page.tsx", content: "// TODO" },
];
const thinMatches = detectTodoStubMatches(thinStub);
assert(thinMatches.shouldBlockPreview, "thin stub app must block");

console.log("verify:todo-stub-preview-gate OK");
