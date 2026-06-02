"use client";

import * as React from "react";

/** Rich mini full-page UI mocks — crisp vectors, no blur when visible. */
export function FashionStoreMock() {
  return (
    <div className="flex h-full w-full flex-col bg-[#0f0a12] text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-2 py-1.5">
        <span className="text-[8px] font-bold tracking-wide text-rose-200">NOVA</span>
        <div className="flex gap-1">
          <span className="size-1.5 rounded-full bg-rose-400" />
          <span className="size-1.5 rounded-full bg-white/30" />
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden p-2">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-600/40 via-fuchsia-700/30 to-violet-900/50" />
        <p className="relative text-[11px] font-black leading-tight">New<br />Season</p>
        <p className="relative mt-0.5 text-[6px] text-rose-100/80">Curated drops · Free ship</p>
        <div className="relative mt-2 grid grid-cols-2 gap-1">
          <div className="aspect-[3/4] rounded-md bg-gradient-to-b from-rose-400 to-rose-700 shadow-lg" />
          <div className="aspect-[3/4] rounded-md bg-gradient-to-b from-fuchsia-400 to-violet-700 shadow-lg" />
        </div>
        <div className="absolute bottom-1.5 left-2 right-2 rounded-full bg-white py-1 text-center text-[6px] font-bold text-rose-900">
          Shop collection
        </div>
      </div>
    </div>
  );
}

export function FoodDeliveryMock() {
  return (
    <div className="flex h-full w-full flex-col bg-[#120c08] text-white">
      <div className="flex items-center gap-1 border-b border-white/10 px-2 py-1.5">
        <span className="text-[8px] font-bold text-amber-200">BITE</span>
        <span className="ml-auto rounded-full bg-emerald-500/90 px-1.5 py-0.5 text-[5px] font-bold">12 min</span>
      </div>
      <div className="flex-1 p-2">
        <div className="h-10 rounded-lg bg-gradient-to-r from-orange-500 to-amber-400 p-1.5 shadow-md">
          <p className="text-[7px] font-bold text-white">Where to?</p>
          <div className="mt-0.5 h-2 rounded bg-white/25" />
        </div>
        <div className="mt-2 space-y-1">
          {["Sushi Palace", "Burger Lab", "Green Bowl"].map((name, i) => (
            <div
              key={name}
              className="flex items-center gap-1.5 rounded-lg bg-white/8 px-1.5 py-1 ring-1 ring-white/10"
            >
              <div
                className={`size-5 shrink-0 rounded-md ${
                  i === 0 ? "bg-orange-400" : i === 1 ? "bg-amber-500" : "bg-lime-500"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[6px] font-semibold">{name}</p>
                <p className="text-[5px] text-white/50">★ 4.{8 - i}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-1">
          <div className="flex-1 rounded-md bg-orange-500/20 py-1 text-center text-[5px] text-orange-200">Track</div>
          <div className="flex-1 rounded-md bg-white/10 py-1 text-center text-[5px]">Offers</div>
        </div>
      </div>
    </div>
  );
}

export function VideoEditorMock() {
  return (
    <div className="flex h-full w-full flex-col bg-[#060a14] text-white">
      <div className="flex items-center justify-between border-b border-cyan-500/20 px-2 py-1.5">
        <span className="text-[8px] font-bold text-cyan-300">FRAME AI</span>
        <span className="rounded bg-cyan-500/20 px-1 text-[5px] text-cyan-200">PRO</span>
      </div>
      <div className="relative flex-1 p-2">
        <div className="aspect-video w-full overflow-hidden rounded-md bg-gradient-to-br from-slate-800 to-indigo-950 ring-1 ring-cyan-400/30">
          <div className="flex h-full items-end gap-0.5 p-1">
            {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm bg-gradient-to-t from-cyan-500 to-blue-400"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-5 rounded-full bg-white/90 shadow-lg ring-2 ring-cyan-400/50" />
          </div>
        </div>
        <div className="mt-1.5 flex gap-0.5">
          {["Cut", "FX", "AI", "Export"].map((t) => (
            <span
              key={t}
              className="flex-1 rounded bg-white/8 py-0.5 text-center text-[5px] font-medium text-cyan-100/90"
            >
              {t}
            </span>
          ))}
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" />
        </div>
      </div>
    </div>
  );
}

export function FinanceMock() {
  return (
    <div className="flex h-full w-full flex-col bg-[#061210] text-white">
      <div className="border-b border-emerald-500/15 px-2 py-1.5">
        <p className="text-[8px] font-bold text-emerald-200">APEX PAY</p>
        <p className="text-[5px] text-white/45">Good morning</p>
      </div>
      <div className="flex-1 p-2">
        <p className="text-[6px] text-white/50">Total balance</p>
        <p className="text-[14px] font-black tabular-nums tracking-tight text-emerald-300">$24,580</p>
        <p className="text-[5px] text-emerald-400/80">+12.4% this month</p>
        <div className="mt-2 flex h-12 items-end gap-0.5">
          {[35, 50, 42, 68, 55, 78, 62, 85].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm bg-gradient-to-t from-emerald-600 to-teal-400"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1">
          <div className="rounded-md bg-white/8 p-1 ring-1 ring-emerald-500/20">
            <p className="text-[5px] text-white/50">Invest</p>
            <p className="text-[7px] font-bold">$8.2k</p>
          </div>
          <div className="rounded-md bg-white/8 p-1 ring-1 ring-emerald-500/20">
            <p className="text-[5px] text-white/50">Spend</p>
            <p className="text-[7px] font-bold">$1.4k</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export const INTRO_SHOWCASE_MOCKS = [
  { id: "fashion", Mock: FashionStoreMock },
  { id: "food", Mock: FoodDeliveryMock },
  { id: "video", Mock: VideoEditorMock },
  { id: "finance", Mock: FinanceMock },
] as const;
