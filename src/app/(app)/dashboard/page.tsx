import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  LayoutGrid,
  Zap,
  MessageSquare,
  BarChart3,
  CreditCard,
  Settings2,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Shortcuts to apps, AI chat, tokens, and workspace settings.",
};

const links: { href: string; label: string; desc: string; icon: typeof LayoutGrid }[] = [
  { href: "/create", label: "Create", desc: "Build or iterate on an app with AI", icon: Sparkles },
  { href: "/projects", label: "Your apps", desc: "Open and manage everything you ship", icon: LayoutGrid },
  { href: "/chat", label: "AI Chat", desc: "Models, saved threads, attachments", icon: MessageSquare },
  { href: "/credits", label: "Tokens", desc: "Usage, quotas, and upgrades", icon: Zap },
  { href: "/analytics", label: "Analytics", desc: "Generation and activity insights", icon: BarChart3 },
  { href: "/settings", label: "Dream Space", desc: "Icon, name, tokens, and appearance", icon: Settings2 },
  { href: "/settings/billing", label: "Billing", desc: "Plan and payment methods", icon: CreditCard },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  return (
    <div className="dashboard-shell mx-auto flex w-full max-w-4xl flex-col gap-8 overflow-x-hidden px-4 py-8 sm:py-10">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-accent/20 bg-gradient-to-br from-accent/[0.12] via-background to-violet-500/[0.06] px-5 py-7 ring-1 ring-accent/10 sm:px-8 sm:py-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 75% 60% at 20% 0%, color-mix(in oklab, var(--accent) 18%, transparent), transparent 60%)",
          }}
        />
        <p className="relative text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Workspace hub</p>
        <h1 className="relative mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Dashboard</h1>
        <p className="relative mt-2 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
          Jump to create, your apps, chat, billing, and settings — everything in one place.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-start gap-3 rounded-[var(--radius-xl)] bg-surface p-4 ring-1 ring-border transition hover:ring-accent/30 hover:shadow-md"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/15">
                <Icon className="size-[18px]" strokeWidth={1.65} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-[14px] font-semibold text-foreground">
                  {item.label}
                  <ArrowRight className="size-3.5 text-muted-foreground opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" strokeWidth={2} />
                </div>
                <p className="mt-0.5 text-[12px] text-muted-foreground leading-snug">{item.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
