/**
 * Benchmark UI scoring — structure fixtures for all 10 app types.
 * Run via run-benchmark-smoke.mjs (structure mode) or directly with tsx.
 */
import { reviewGeneratedUi, passesUiQualityGate } from "../src/lib/generation/generated-ui-review";
import { UI_QUALITY_BENCHMARK_TARGETS, UI_QUALITY_THRESHOLDS } from "../src/lib/generation/ui-quality-spec";
import { SMOKE_PROMPT_APP_TYPES } from "../src/lib/generation/app-type-ui-requirements";

type Fixture = {
  id: string;
  appType: string;
  stylePresetId: string;
  routeMap?: string[];
  files: Array<{ path: string; content: string }>;
};

const PKG = { path: "package.json", content: '{"name":"bench","dependencies":{"react":"19","next":"16"}}' };

const STATES =
  '<div className="loading skeleton animate-pulse text-sm">Loading</div><div className="empty text-sm">Nothing here yet — get started</div><div className="error text-sm text-red-600">Something went wrong — try again</div>';

function shell(nav: string, body: string) {
  return `export default function Page() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row gap-4 p-4 sm:p-6 bg-slate-50">
      <nav className="border-r p-4 space-y-2 text-sm font-medium">${nav}</nav>
      <main className="flex-1 space-y-4">${body}${STATES}</main>
    </div>
  );
}`;
}

const FIXTURES: Fixture[] = [
  {
    id: "smoke-landing",
    appType: "landing",
    stylePresetId: "glass",
    files: [
      {
        path: "app/page.tsx",
        content: `export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-cyan-400">
      <header className="nav flex justify-between p-4 sm:p-6"><span className="font-semibold text-lg">Calm</span></header>
      <section className="hero text-center py-16 px-4 space-y-4">
        <h1 className="text-3xl font-bold text-white">Meditation made simple</h1>
        <p className="text-sm text-white/80 max-w-lg mx-auto">Daily calm with guided sessions</p>
        <form onSubmit={() => {}} className="flex flex-col sm:flex-row gap-2 justify-center max-w-md mx-auto">
          <input className="rounded-xl px-4 py-2 backdrop-blur bg-white/20 border border-white/30" placeholder="Email signup" />
          <button type="submit" className="rounded-xl px-6 py-2 bg-white/20 backdrop-blur font-semibold" onClick={() => {}}>Get started</button>
        </form>
      </section>
      <section className="problem solution py-8 px-4 max-w-3xl mx-auto text-white/90 text-sm space-y-2">
        <h2 className="text-xl font-semibold">The problem we solve</h2>
        <p>Stress and distraction are the pain — our solution is guided daily calm.</p>
      </section>
      <section className="social proof py-6 px-4 text-center text-white/80 text-sm">
        <p>Trusted by 10,000+ customers</p>
        <div className="testimonial mt-2">★★★★★ Best meditation app</div>
      </section>
      <section className="feature grid grid-cols-1 md:grid-cols-3 gap-4 p-6 max-w-5xl mx-auto">
        <div className="card backdrop-blur bg-white/10 border border-white/20 rounded-xl p-4 shadow-xl">Feature one</div>
        <div className="card backdrop-blur bg-white/10 border rounded-xl p-4">Feature two</div>
        <div className="card backdrop-blur bg-white/10 border rounded-xl p-4">Feature three</div>
      </section>
      <footer className="footer p-6 text-center text-sm text-white/70">
        <div className="faq space-y-2 mb-4"><p className="font-medium">FAQ</p><p>How does billing work?</p></div>
        © Calm
      </footer>
      ${STATES}
    </div>
  );
}`,
      },
      PKG,
    ],
  },
  {
    id: "smoke-saas-dash",
    appType: "saas_dashboard",
    stylePresetId: "enterprise",
    routeMap: ["/dashboard", "/settings"],
    files: [
      {
        path: "app/dashboard/page.tsx",
        content: shell(
          '<a href="/settings">Settings</a>',
          `<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="metric card stat border rounded-md p-4 text-sm">Revenue</div>
            <div className="metric card stat border rounded-md p-4">Users</div>
            <div className="metric card stat border rounded-md p-4">MRR</div>
            <div className="metric card stat border rounded-md p-4">Churn</div>
          </div>
          <input className="border rounded-md px-3 py-1.5 text-sm" placeholder="Search filter" />
          <div className="chart border rounded-md p-4 h-48">Chart area</div>
          <table className="w-full text-xs"><thead><tr><th>Date</th><th>Amount</th></tr></thead><tbody><tr><td>Today</td><td>$1k</td></tr></tbody></table>
          <div className="loading skeleton animate-pulse">Loading</div>
          <div className="empty text-sm">No data yet</div>
          <div className="error text-red-600">Something went wrong — try again</div>`,
        ),
      },
      { path: "app/settings/page.tsx", content: shell("", `<h1 className="text-xl font-medium">Team settings</h1><button className="bg-blue-700 text-white rounded-md px-3 py-1.5" onClick={() => {}}>Invite</button>`) },
      PKG,
    ],
  },
  {
    id: "smoke-crm",
    appType: "crm",
    stylePresetId: "enterprise",
    routeMap: ["/contacts", "/deals", "/dashboard"],
    files: [
      { path: "app/contacts/page.tsx", content: shell('<a href="/deals">Deals</a>', `<input placeholder="Search contacts" className="border rounded-md px-3 text-sm" /><form onSubmit={() => {}}><button type="submit" className="bg-blue-700 text-white rounded-md px-3 py-1.5 text-sm">Add patient</button></form><div className="card border rounded-md p-4">Patient contact list</div><div className="empty">No contacts yet — get started</div><div className="loading animate-pulse">Loading</div><div className="error">Try again</div>`) },
      { path: "app/deals/page.tsx", content: shell("", `<h1 className="text-2xl font-semibold">Deal pipeline</h1><div className="task follow-up">Follow-up tasks</div>`) },
      { path: "app/dashboard/page.tsx", content: shell("", `<div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="metric card stat border rounded-md p-4">Appointments</div></div>`) },
      PKG,
    ],
  },
  {
    id: "smoke-booking",
    appType: "booking",
    stylePresetId: "minimal",
    routeMap: ["/book", "/confirm"],
    files: [
      { path: "app/book/page.tsx", content: shell("", `<div className="service card border rounded-lg p-4">Stylist services</div><div className="calendar grid grid-cols-7 gap-2 sm:gap-4"><button className="h-11 rounded-lg border" onClick={() => {}}>Mon 10am</button></div><div className="summary border rounded-lg p-4">Booking summary</div><div className="empty text-sm text-slate-500">No slots available today — try another date</div>`) },
      { path: "app/confirm/page.tsx", content: shell("", `<div className="confirm success text-lg font-semibold">Booking confirmed</div><p className="text-sm">Reminder sent</p><button className="bg-slate-900 text-white rounded-lg px-4 py-2" onClick={() => {}}>Done</button>`) },
      PKG,
    ],
  },
  {
    id: "smoke-finance",
    appType: "finance_dashboard",
    stylePresetId: "minimal",
    routeMap: ["/dashboard", "/transactions"],
    files: [
      { path: "app/dashboard/page.tsx", content: shell('<a href="/transactions">Transactions</a>', `<div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="balance card border rounded-lg shadow-sm p-4 font-semibold text-sm">Budget $2,400</div><div className="card border border-slate-200 rounded-lg p-4 text-sm">Income</div><div className="card border rounded-lg p-4">Expense</div></div><div className="insight card border rounded-lg p-4 text-sm">Spending insight: reduce dining out</div><div className="chart border rounded-lg p-4 h-40">Spending trend</div><form onSubmit={() => {}}><input placeholder="Filter date range" className="border border-slate-200 rounded-lg px-3 py-2 text-sm" /></form>`) },
      { path: "app/transactions/page.tsx", content: shell('<a href="/dashboard">Dashboard</a>', `<table className="w-full text-sm"><thead><tr><th>Transaction</th><th>Category</th></tr></thead><tbody><tr><td>Grocery</td><td>Food</td></tr></tbody></table><button className="bg-slate-900 text-white rounded-lg px-4 py-2 shadow-sm" onClick={() => {}}>Export</button>`) },
      PKG,
    ],
  },
  {
    id: "smoke-ai-tool",
    appType: "ai_tool",
    stylePresetId: "bold",
    routeMap: ["/write", "/history"],
    files: [
      { path: "app/write/page.tsx", content: `export default function Write() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row gap-4 p-4 bg-zinc-950 text-white">
      <nav className="sidebar md:hidden border border-violet-500/20 rounded-2xl p-2 text-sm"><a href="/history">History</a></nav>
      <aside className="history sidebar w-full md:w-64 border border-violet-500/20 rounded-2xl p-4 space-y-2 shadow-lg">
        <h2 className="font-bold text-lg">History</h2>
        <div className="session card border rounded-2xl p-3 text-sm text-zinc-400">Previous prompt saved</div>
      </aside>
      <main className="flex-1 space-y-4">
        <textarea className="prompt w-full rounded-2xl bg-zinc-900 border border-violet-500/20 p-4 text-base" placeholder="Compose message" />
        <p className="credits text-sm text-violet-300">Credits remaining: 42</p>
        <button className="bg-violet-600 font-bold rounded-2xl px-6 py-3 shadow-lg" onClick={() => {}}>Send</button>
        <div className="output stream border border-violet-500/20 rounded-2xl p-4 min-h-32">Generated response stream</div>
        <button className="text-sm" onClick={() => {}}>Copy</button>
        <button className="text-sm" onClick={() => {}}>Regenerate</button>
        <div className="loading animate-pulse">Generating...</div>
        <div className="empty text-sm text-zinc-400">No history yet — get started</div>
        <div className="error text-red-400 text-sm">Generation failed — try again</div>
      </main>
    </div>
  );
}` },
      { path: "app/history/page.tsx", content: shell('<a href="/write">Write</a>', `<div className="card border border-violet-500/20 rounded-2xl p-4 bg-zinc-900 font-bold">Saved sessions</div><button className="bg-violet-600 rounded-2xl px-4 py-2 shadow-lg" onClick={() => {}}>Open</button>`) },
      PKG,
    ],
  },
  {
    id: "smoke-community",
    appType: "community",
    stylePresetId: "minimal",
    routeMap: ["/feed", "/profile"],
    files: [
      { path: "app/feed/page.tsx", content: shell('<a href="/profile">Profile</a>', `<button className="bg-slate-900 text-white rounded-lg px-4 py-2 mb-4" onClick={() => {}}>Create post</button><article className="post card border rounded-lg p-4 space-y-2"><div className="flex gap-2"><div className="avatar w-8 h-8 rounded-full bg-slate-200" /><span className="font-semibold text-sm">Member</span></div><p className="text-sm">Discussion thread starter</p><div className="flex gap-3 text-sm"><button onClick={() => {}}>♥ Like</button><span className="comment text-slate-600">Reply comment</span></div></article><div className="empty text-sm">No posts yet — get started</div>`) },
      { path: "app/profile/page.tsx", content: shell("", `<div className="profile flex gap-4 items-center"><div className="avatar w-16 h-16 rounded-full bg-slate-200" /><h1 className="text-xl font-semibold">User profile</h1></div>`) },
      PKG,
    ],
  },
  {
    id: "smoke-admin",
    appType: "admin_panel",
    stylePresetId: "enterprise",
    routeMap: ["/admin/users", "/admin/audit"],
    files: [
      { path: "app/admin/users/page.tsx", content: shell('<a href="/admin/audit">Audit</a>', `<div className="grid grid-cols-3 gap-4 mb-4"><div className="metric card stat border rounded-md p-3 text-xs">Users 128</div><div className="metric card stat border rounded-md p-3 text-xs">Active 94</div><div className="metric card stat border rounded-md p-3 text-xs">Pending 3</div></div><input placeholder="Search users" className="border rounded-md px-3 text-xs" /><table className="w-full text-xs"><thead><tr><th>User</th><th>Role</th><th>Actions</th></tr></thead><tbody><tr><td>Jane</td><td>Admin</td><td><button onClick={() => {}}>Edit</button></td></tr></tbody></table>`) },
      { path: "app/admin/audit/page.tsx", content: shell("", `<h1 className="text-lg font-medium">Audit log</h1><table className="w-full text-xs"><thead><tr><th>Event</th><th>Time</th></tr></thead><tbody><tr><td>Login</td><td>Today</td></tr></tbody></table>`) },
      PKG,
    ],
  },
  {
    id: "smoke-mobile-habit",
    appType: "habit_tracker",
    stylePresetId: "bold",
    files: [
      { path: "app/page.tsx", content: `export default function Habits() {
  return (
    <div className="min-h-screen flex flex-col p-4 sm:p-6 bg-zinc-950 text-white">
      <header className="nav flex items-center justify-between mb-4"><h1 className="text-2xl font-bold">Today</h1></header>
      <div className="habit list space-y-3 flex-1">
        <div className="habit card border border-violet-500/20 rounded-2xl p-4 flex justify-between items-center">
          <span className="font-bold">Meditate</span>
          <span className="streak text-violet-400 text-sm">7 day streak</span>
        </div>
        <div className="habit card border rounded-2xl p-4">Exercise</div>
      </div>
      <div className="sticky bottom-0 py-4">
        <button className="w-full h-11 bg-violet-600 font-bold rounded-2xl" onClick={() => {}}>Daily check-in</button>
      </div>
      <div className="progress text-sm text-zinc-400">Progress today</div>
      <div className="chart border border-violet-500/20 rounded-2xl p-4 h-24">Weekly progress chart</div>
      ${STATES}
    </div>
  );
}` },
      PKG,
    ],
  },
  {
    id: "smoke-ecommerce",
    appType: "ecommerce",
    stylePresetId: "minimal",
    routeMap: ["/shop", "/cart"],
    files: [
      { path: "app/shop/page.tsx", content: shell('<a href="/cart">Cart</a>', `<div className="product grid grid-cols-2 md:grid-cols-3 gap-4"><div className="card border rounded-lg p-4"><p className="font-semibold text-sm">Product</p><p className="text-xs text-slate-500">Product detail description and size</p><p className="text-lg">$29</p><button className="mt-2 bg-slate-900 text-white rounded-lg px-3 py-2 text-sm w-full" onClick={() => {}}>Add to cart</button></div></div>`) },
      { path: "app/cart/page.tsx", content: shell("", `<h1 className="text-xl font-semibold">Cart</h1><div className="border rounded-lg p-4 flex justify-between"><span>Product</span><span className="price">$29</span></div><p className="text-lg font-bold">Total: $29</p><button className="bg-slate-900 text-white rounded-lg px-4 py-2 w-full" onClick={() => {}}>Checkout</button><p className="empty text-sm text-slate-500 mt-4">Cart is empty — start shopping</p>`) },
      PKG,
    ],
  },
];

const PLACEHOLDER = {
  id: "placeholder",
  appType: "crm",
  files: PLACEHOLDER_FILES_FROM_TESTS(),
};

function PLACEHOLDER_FILES_FROM_TESTS() {
  return [
    { path: "app/page.tsx", content: `<main><h1>Welcome</h1><p>Coming soon — TODO: implement</p></main>` },
    { path: "package.json", content: '{"name":"bad"}' },
  ];
}

export function runBenchmarkUiScore() {
  const results: Array<{
    id: string;
    appType: string;
    overall: number;
    passesGate: boolean;
    placeholderLike: boolean;
    appTypeScore: number;
  }> = [];

  for (const fx of FIXTURES) {
    const score = reviewGeneratedUi({
      files: fx.files,
      appType: fx.appType,
      stylePresetId: fx.stylePresetId,
      routeMap: fx.routeMap,
    });
    results.push({
      id: fx.id,
      appType: fx.appType,
      overall: score.overall,
      passesGate: score.passesGate,
      placeholderLike: score.placeholderLike,
      appTypeScore: score.appTypeScore,
    });
  }

  const ph = reviewGeneratedUi({ files: PLACEHOLDER.files, appType: "crm" });
  results.push({
    id: "placeholder-control",
    appType: "crm",
    overall: ph.overall,
    passesGate: ph.passesGate,
    placeholderLike: ph.placeholderLike,
    appTypeScore: ph.appTypeScore,
  });

  const good = results.filter((r) => r.id !== "placeholder-control");
  const passCount = good.filter((r) => r.passesGate).length;
  const placeholderCount = good.filter((r) => r.placeholderLike).length;
  const avgScore = good.reduce((s, r) => s + r.overall, 0) / good.length;
  const buildSuccessRate = passCount / good.length;
  /** Control fixture tracked separately — rate is over generated-app fixtures only. */
  const placeholderRate = placeholderCount / good.length;
  const placeholderControlPassed = !ph.passesGate && ph.placeholderLike;

  return {
    mode: "structure_fixtures",
    promptCount: good.length,
    buildSuccessRate,
    placeholderRate,
    averageQualityScore: Math.round(avgScore),
    previewSuccessRate: buildSuccessRate,
    smokePassed:
      buildSuccessRate >= UI_QUALITY_BENCHMARK_TARGETS.buildSuccessRate &&
      placeholderRate <= UI_QUALITY_BENCHMARK_TARGETS.placeholderRate &&
      avgScore >= UI_QUALITY_BENCHMARK_TARGETS.averageUiScore,
    results,
    thresholds: UI_QUALITY_THRESHOLDS,
    targets: UI_QUALITY_BENCHMARK_TARGETS,
    failedAppTypes: good.filter((r) => !r.passesGate).map((r) => r.appType),
    placeholderControlPassed,
    reason: `Structure fixtures: ${passCount}/${good.length} pass gate, avg ${avgScore.toFixed(1)}, placeholder control ${placeholderControlPassed ? "blocked" : "FAILED"}`,
  };
}

if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, "/") ?? "") || process.argv[1]?.includes("benchmark-ui-score")) {
  const out = runBenchmarkUiScore();
  console.log(JSON.stringify(out, null, 2));
}

export { FIXTURES, SMOKE_PROMPT_APP_TYPES };
