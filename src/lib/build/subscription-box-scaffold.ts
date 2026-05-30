import type { BuildFile } from "@/lib/build/generated-file-utils";
import { normalizeBuildFilePath } from "@/lib/build/generated-file-utils";
import {
  dreamOSBrandingLayoutFooterJsx,
  dreamOSLoginPageScaffold,
} from "@/lib/branding/generated-app-branding";

/** Deterministic subscription-box manager scaffold when model output is weak. */
export function subscriptionBoxScaffoldFiles(appName: string): BuildFile[] {
  const name = appName.trim() || "BoxFlow";
  const esc = (s: string) => s.replace(/"/g, '\\"');

  const files: BuildFile[] = [
    {
      path: "app/layout.tsx",
      content: `import "./globals.css";
import Link from "next/link";

export const metadata = { title: "${esc(name)}" };

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/subscribers", label: "Subscribers" },
  { href: "/boxes", label: "Box curation" },
  { href: "/shipments", label: "Shipments" },
  { href: "/analytics", label: "Churn analytics" },
  { href: "/settings", label: "Settings" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-slate-50 text-slate-900 antialiased">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/dashboard" className="text-sm font-semibold tracking-tight">${esc(name)}</Link>
            <nav className="flex flex-wrap gap-1 text-sm">
              {nav.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-lg px-2.5 py-1.5 text-slate-600 hover:bg-slate-100">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>${dreamOSBrandingLayoutFooterJsx()}
      </body>
    </html>
  );
}
`,
    },
    {
      path: "app/login/page.tsx",
      content: dreamOSLoginPageScaffold(name),
    },
    {
      path: "app/globals.css",
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;
body { font-feature-settings: "ss01"; }
.card { @apply rounded-xl border border-slate-200 bg-white p-4 shadow-sm; }
.badge { @apply inline-flex rounded-full px-2 py-0.5 text-xs font-medium; }
`,
    },
    {
      path: "app/page.tsx",
      content: `import { redirect } from "next/navigation";
export default function Home() { redirect("/dashboard"); }
`,
    },
    {
      path: "app/dashboard/page.tsx",
      content: `import { metrics } from "@/lib/mock-data";
import { MetricCard } from "@/components/MetricCard";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Subscription overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <MetricCard key={m.label} label={m.label} value={m.value} hint={m.hint} />
        ))}
      </div>
      <p className="text-sm text-slate-600">Track subscribers, curate monthly boxes, export shipping labels, and monitor churn.</p>
    </div>
  );
}
`,
    },
    {
      path: "app/subscribers/page.tsx",
      content: `import { subscribers } from "@/lib/mock-data";
import { StatusBadge } from "@/components/StatusBadge";

export default function SubscribersPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Subscribers</h1>
      <div className="card overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Next box</th></tr>
          </thead>
          <tbody>
            {subscribers.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">{s.plan}</td>
                <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                <td className="px-4 py-3 text-slate-600">{s.nextBox}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
`,
    },
    {
      path: "app/boxes/page.tsx",
      content: `import { monthlyBoxes } from "@/lib/mock-data";

export default function BoxesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Monthly box curation</h1>
      <ul className="grid gap-3 md:grid-cols-2">
        {monthlyBoxes.map((box) => (
          <li key={box.id} className="card">
            <p className="font-semibold">{box.title}</p>
            <p className="mt-1 text-sm text-slate-600">{box.items} items · ships {box.shipDate}</p>
            <p className="mt-2 text-xs text-violet-700">{box.status}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
`,
    },
    {
      path: "app/shipments/page.tsx",
      content: `import { shipments } from "@/lib/mock-data";

export default function ShipmentsPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Shipments & labels</h1>
        <button type="button" className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white">
          Export shipping labels (CSV)
        </button>
      </div>
      <div className="card overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Carrier</th><th className="px-4 py-3">Status</th></tr>
          </thead>
          <tbody>
            {shipments.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{s.id}</td>
                <td className="px-4 py-3">{s.carrier}</td>
                <td className="px-4 py-3">{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
`,
    },
    {
      path: "app/analytics/page.tsx",
      content: `import { churnMetrics } from "@/lib/mock-data";

export default function AnalyticsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Churn analytics</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {churnMetrics.map((c) => (
          <div key={c.label} className="card">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="mt-1 text-2xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
`,
    },
    {
      path: "app/settings/page.tsx",
      content: `export default function SettingsPage() {
  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Billing & settings</h1>
      <div className="card space-y-3">
        <label className="block text-sm font-medium">Brand name</label>
        <input className="w-full rounded-lg border px-3 py-2 text-sm" defaultValue="${esc(name)}" />
        <button type="button" className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white">Save</button>
      </div>
    </div>
  );
}
`,
    },
    {
      path: "lib/mock-data.ts",
      content: `export const metrics = [
  { label: "Active subscribers", value: "2,840", hint: "+6% vs last month" },
  { label: "Boxes shipping this week", value: "612", hint: "March curated box" },
  { label: "Churn rate", value: "2.1%", hint: "30-day rolling" },
  { label: "MRR", value: "$84.2k", hint: "All plans" },
];

export const subscribers = [
  { id: "1", name: "Alex Rivera", plan: "Premium", status: "Active", nextBox: "Mar 28" },
  { id: "2", name: "Jordan Lee", plan: "Standard", status: "Paused", nextBox: "—" },
  { id: "3", name: "Sam Patel", plan: "Premium", status: "Active", nextBox: "Mar 28" },
];

export const monthlyBoxes = [
  { id: "b1", title: "March — Artisan snacks", items: 8, shipDate: "Mar 28", status: "Curating" },
  { id: "b2", title: "February — Wellness kit", items: 6, shipDate: "Feb 26", status: "Shipped" },
];

export const shipments = [
  { id: "SH-1042", carrier: "USPS", status: "Label printed" },
  { id: "SH-1041", carrier: "UPS", status: "In transit" },
];

export const churnMetrics = [
  { label: "30-day churn", value: "2.1%" },
  { label: "Cancellations", value: "58" },
  { label: "Saved via win-back", value: "12" },
];
`,
    },
    {
      path: "lib/types.ts",
      content: `export type Subscriber = { id: string; name: string; plan: string; status: string; nextBox: string };
`,
    },
    {
      path: "components/MetricCard.tsx",
      content: `export function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
`,
    },
    {
      path: "components/DataTable.tsx",
      content: `import type { ReactNode } from "react";

export function DataTable({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  return (
    <div className="card overflow-hidden p-0">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
          <tr>{columns.map((c) => <th key={c} className="px-4 py-3">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              {row.map((cell, j) => <td key={j} className="px-4 py-3">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
`,
    },
    {
      path: "components/StatusBadge.tsx",
      content: `export function StatusBadge({ status }: { status: string }) {
  const tone = status === "Active" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800";
  return <span className={"badge " + tone}>{status}</span>;
}
`,
    },
    {
      path: "components/AppShell.tsx",
      content: `export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </section>
  );
}
`,
    },
  ];

  return files.map((f) => ({ ...f, path: normalizeBuildFilePath(f.path) }));
}

export function mergeSubscriptionBoxScaffold(files: BuildFile[], appName: string): BuildFile[] {
  const scaffold = subscriptionBoxScaffoldFiles(appName);
  const byPath = new Map<string, BuildFile>();
  for (const f of scaffold) byPath.set(f.path, f);
  for (const f of files) {
    const path = normalizeBuildFilePath(f.path);
    if (path && f.content?.trim()) byPath.set(path, { path, content: f.content });
  }
  return [...byPath.values()];
}
