"use client";

import * as React from "react";

export type IntroScreenLayout = "desktop" | "mobile";

function PhoneChrome({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[2rem] bg-[#0a0f1a] p-[3px] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.85)] ring-1 ring-white/15 ${className ?? ""}`}
      data-intro-density="mobile-framed"
    >
      <div className="absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-black/80" />
      <div className="relative h-full w-full overflow-hidden rounded-[1.65rem]">{children}</div>
    </div>
  );
}

function DesktopChrome({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative flex h-full w-full flex-col overflow-hidden rounded-xl bg-[#0c1220] shadow-[0_48px_100px_-24px_rgba(0,0,0,0.9)] ring-1 ring-sky-400/25 ${className ?? ""}`}
      data-intro-density="desktop-framed"
    >
      <div className="flex h-7 shrink-0 items-center gap-1.5 border-b border-white/10 bg-[#111827] px-3">
        <span className="size-2 rounded-full bg-red-400/90" />
        <span className="size-2 rounded-full bg-amber-400/90" />
        <span className="size-2 rounded-full bg-emerald-400/90" />
        <span className="ml-2 text-[9px] text-white/35">vodex.app — generated</span>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

/** APP 1 — luxury fashion store */
export function IntroFashionScreen({ layout }: { layout: IntroScreenLayout }) {
  const inner = (
    <div className="flex h-full w-full flex-col bg-[#09070d] text-white" data-intro-app="fashion-store">
      <header className="flex items-center justify-between border-b border-white/8 px-3 py-2 backdrop-blur-md">
        <span className="text-[12px] font-black tracking-[0.15em] text-violet-400">NOVA</span>
        <nav className="hidden gap-3 text-[8px] text-white/50 sm:flex">
          <span>Women</span>
          <span>Men</span>
          <span>Runway</span>
        </nav>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[7px]">Bag · 2</span>
          <span className="size-5 rounded-full bg-gradient-to-br from-rose-400 to-fuchsia-600" />
        </div>
      </header>
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-900/50 via-[#1a0a14] to-violet-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(251,113,133,0.35),transparent_55%)]" />
        <div className="relative flex h-full flex-col p-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-xl">
            <p className="text-[9px] uppercase tracking-widest text-rose-200/80">Spring collection</p>
            <h1 className="mt-1 text-lg font-black leading-tight tracking-tight">Silk &amp; Structure</h1>
            <p className="mt-1 max-w-[70%] text-[8px] text-white/55">Architectural tailoring · Limited drop</p>
            <button
              type="button"
              className="mt-2 rounded-full bg-white px-3 py-1 text-[8px] font-bold text-rose-950"
            >
              Shop the edit
            </button>
          </div>
          <div className="mt-2 grid flex-1 grid-cols-3 gap-1.5">
            {[
              "from-rose-500 to-rose-800",
              "from-fuchsia-500 to-violet-800",
              "from-amber-400 to-orange-700",
            ].map((g, i) => (
              <div key={i} className="flex flex-col overflow-hidden rounded-lg ring-1 ring-white/10">
                <div className={`aspect-[3/4] bg-gradient-to-b ${g}`} />
                <div className="bg-black/40 px-1 py-1">
                  <p className="text-[7px] font-semibold">Look {i + 12}</p>
                  <p className="text-[6px] text-white/45">${129 + i * 40}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (layout === "mobile") {
    return <PhoneChrome className="h-full w-full">{inner}</PhoneChrome>;
  }
  return <DesktopChrome>{inner}</DesktopChrome>;
}

/** APP 2 — food delivery */
export function IntroFoodDeliveryScreen({ layout }: { layout: IntroScreenLayout }) {
  const inner = (
    <div className="flex h-full w-full flex-col bg-[#0f0c09] text-white" data-intro-app="food-delivery">
      <header className="flex items-center gap-2 border-b border-white/8 px-3 py-2">
        <span className="text-[12px] font-black text-orange-400">bite.</span>
        <span className="ml-auto rounded-full bg-emerald-500/90 px-2 py-0.5 text-[7px] font-bold">
          12 min
        </span>
      </header>
      <div className="relative h-28 shrink-0 overflow-hidden border-b border-white/8">
        <div className="absolute inset-0 bg-[#1a2e1a]" />
        <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_30%_40%,#4ade80_0%,transparent_35%),radial-gradient(circle_at_70%_60%,#22d3ee_0%,transparent_30%)]" />
        {[
          { t: "18%", l: "22%" },
          { t: "45%", l: "58%" },
          { t: "62%", l: "35%" },
        ].map((p, i) => (
          <span
            key={i}
            className="absolute size-2 rounded-full bg-orange-400 shadow-[0_0_8px_#fb923c]"
            style={{ top: p.t, left: p.l }}
          />
        ))}
        <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-black/50 px-2 py-1 backdrop-blur-md">
          <p className="text-[8px] font-semibold">Delivering to · Downtown</p>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto px-2 py-2">
        {["Burgers", "Sushi", "Healthy", "Dessert"].map((c) => (
          <span
            key={c}
            className="shrink-0 rounded-full bg-orange-500/20 px-2 py-0.5 text-[7px] ring-1 ring-orange-400/30"
          >
            {c}
          </span>
        ))}
      </div>
      <div className="flex-1 space-y-1.5 overflow-hidden px-2 pb-2">
        {[
          { n: "Sushi Palace", m: "★ 4.9", c: "from-red-500 to-rose-700" },
          { n: "Burger Lab", m: "★ 4.7", c: "from-amber-500 to-orange-700" },
          { n: "Green Bowl", m: "★ 4.8", c: "from-lime-500 to-emerald-700" },
        ].map((r) => (
          <div
            key={r.n}
            className="flex gap-2 rounded-xl bg-white/5 p-1.5 ring-1 ring-white/10"
          >
            <div className={`size-10 shrink-0 rounded-lg bg-gradient-to-br ${r.c}`} />
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold">{r.n}</p>
              <p className="text-[7px] text-white/45">{r.m} · 25–35 min</p>
            </div>
            <span className="self-center rounded-lg bg-orange-500 px-1.5 py-0.5 text-[6px] font-bold">
              Order
            </span>
          </div>
        ))}
        <div className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-2 text-center text-[8px] font-bold text-white">
          Checkout · $24.50
        </div>
      </div>
    </div>
  );

  if (layout === "mobile") return <PhoneChrome className="h-full w-full">{inner}</PhoneChrome>;
  return <DesktopChrome>{inner}</DesktopChrome>;
}

/** APP 3 — AI video editor */
export function IntroVideoEditorScreen({ layout }: { layout: IntroScreenLayout }) {
  const inner = (
    <div className="flex h-full w-full bg-[#060a12] text-white" data-intro-app="ai-video-editor">
      <aside className="hidden w-[22%] shrink-0 flex-col border-r border-cyan-500/15 bg-[#081018] p-2 sm:flex">
        <p className="text-[7px] font-bold uppercase tracking-wider text-cyan-300/80">AI Tools</p>
        {["Auto cut", "Color grade", "Captions", "B-roll gen"].map((t) => (
          <div
            key={t}
            className="mt-1 rounded-md bg-cyan-500/10 px-1.5 py-1 text-[7px] ring-1 ring-cyan-400/20"
          >
            {t}
          </div>
        ))}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-white/8 px-2 py-1.5">
          <span className="text-[10px] font-bold text-cyan-200">FRAME AI</span>
          <span className="text-[7px] text-white/40">Project · Neon reel</span>
        </header>
        <div className="relative m-2 aspect-video overflow-hidden rounded-lg ring-1 ring-cyan-400/30">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-indigo-950 to-black" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="size-8 rounded-full bg-white/90 shadow-lg ring-2 ring-cyan-400/50" />
          </div>
          <div className="absolute bottom-1 left-1 right-1 flex gap-0.5">
            {[30, 55, 40, 70, 50].map((w, i) => (
              <div key={i} className="h-3 flex-1 rounded-sm bg-cyan-400/40" style={{ opacity: w / 100 }} />
            ))}
          </div>
        </div>
        <div className="mx-2 mb-1 flex-1 rounded-lg bg-[#0a1018] p-1.5 ring-1 ring-white/8">
          <div className="flex h-6 items-end gap-px">
            {Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm bg-gradient-to-t from-cyan-600 to-blue-400"
                style={{ height: `${25 + ((i * 17) % 70)}%` }}
              />
            ))}
          </div>
          <div className="mt-1 h-0.5 rounded-full bg-cyan-500/80" style={{ width: "42%" }} />
          <p className="mt-0.5 text-[6px] text-white/35">Timeline · 00:14:22 · 4K</p>
        </div>
      </div>
    </div>
  );

  if (layout === "mobile") return <PhoneChrome className="h-full w-full">{inner}</PhoneChrome>;
  return <DesktopChrome>{inner}</DesktopChrome>;
}

/** APP 4 — finance */
export function IntroFinanceScreen({ layout }: { layout: IntroScreenLayout }) {
  const inner = (
    <div className="flex h-full w-full flex-col bg-[#050f0d] text-white" data-intro-app="finance-app">
      <header className="flex items-center justify-between border-b border-emerald-500/15 px-3 py-2">
        <div>
          <p className="text-[10px] font-bold text-emerald-200">APEX FINANCE</p>
          <p className="text-[7px] text-white/40">Business · USD</p>
        </div>
        <span className="rounded-lg bg-emerald-500/15 px-2 py-0.5 text-[7px] text-emerald-300">Live</span>
      </header>
      <div className="flex-1 overflow-hidden p-3">
        <p className="text-[8px] text-white/45">Total balance</p>
        <p className="text-2xl font-black tabular-nums tracking-tight text-emerald-300">$128,420</p>
        <p className="text-[8px] text-emerald-400">+18.2% vs last month</p>
        <div className="mt-2 flex h-20 items-end gap-0.5 rounded-xl bg-white/5 p-2 ring-1 ring-emerald-500/15">
          {[40, 55, 48, 72, 65, 88, 78, 95, 82, 100].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-gradient-to-t from-emerald-600 to-teal-300 shadow-[0_0_12px_rgba(52,211,153,0.35)]"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <div className="rounded-lg bg-white/5 p-2 ring-1 ring-white/10">
            <p className="text-[7px] text-white/40">Revenue</p>
            <p className="text-[11px] font-bold text-white">$42.1k</p>
          </div>
          <div className="rounded-lg bg-white/5 p-2 ring-1 ring-white/10">
            <p className="text-[7px] text-white/40">Spend</p>
            <p className="text-[11px] font-bold text-white">$8.4k</p>
          </div>
        </div>
        <div className="mt-2 space-y-1">
          {[
            { l: "Stripe payout", a: "+$4,200" },
            { l: "AWS infra", a: "-$890" },
            { l: "Payroll", a: "-$12,400" },
          ].map((t) => (
            <div
              key={t.l}
              className="flex justify-between rounded-md bg-black/25 px-2 py-1 text-[7px] ring-1 ring-white/5"
            >
              <span className="text-white/70">{t.l}</span>
              <span className={t.a.startsWith("+") ? "text-emerald-400" : "text-rose-300"}>{t.a}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (layout === "mobile") return <PhoneChrome className="h-full w-full">{inner}</PhoneChrome>;
  return <DesktopChrome>{inner}</DesktopChrome>;
}

export const INTRO_V3_APPS = [
  { id: "fashion", Screen: IntroFashionScreen, label: "Fashion store" },
  { id: "food", Screen: IntroFoodDeliveryScreen, label: "Food delivery" },
  { id: "video", Screen: IntroVideoEditorScreen, label: "AI video editor" },
  { id: "finance", Screen: IntroFinanceScreen, label: "Finance app" },
] as const;
